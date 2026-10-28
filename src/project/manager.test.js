import ProjectManager from './manager';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('vscode', () => jest.requireActual('../../__mocks__/vscode'));

describe('ProjectManager configuration change handling', () => {
  let projectDir;
  let configPath;
  let manager;

  beforeEach(() => {
    jest.useFakeTimers();
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pio-project-manager-'));
    configPath = path.join(projectDir, 'platformio.ini');
    fs.writeFileSync(configPath, '[env]\nboard = esp32\n');

    manager = Object.create(ProjectManager.prototype);
    manager.CONFIG_CHANGED_DELAY = 3;
    manager._configChangedTimeouts = new Map();
    manager._configSnapshots = new Map();
    manager._pendingConfigIndexRebuilds = new Set();
    manager._pool = {
      getActiveProjectDir: jest.fn(),
      getObserver: jest.fn(() => ({ rebuildIndex: jest.fn().mockResolvedValue() })),
    };
    manager.switchToProject = jest.fn();
    manager.rememberProjectConfig(configPath);
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('ignores notifications without a size or modification-time change', () => {
    manager._pool.getActiveProjectDir.mockReturnValue(projectDir);

    manager.handleProjectConfigChange(configPath);
    jest.advanceTimersByTime(manager.CONFIG_CHANGED_DELAY * 1000);

    expect(manager.switchToProject).not.toHaveBeenCalled();
  });

  it('detects changed content when size and modification time are preserved', () => {
    manager._pool.getActiveProjectDir.mockReturnValue(projectDir);
    const configMtime = new Date(Date.now() - 10_000);
    fs.utimesSync(configPath, configMtime, configMtime);
    manager.rememberProjectConfig(configPath);
    const previousSnapshot = manager._configSnapshots.get(path.resolve(configPath));

    fs.writeFileSync(configPath, '[env]\nboard = stm32\n');
    fs.utimesSync(configPath, configMtime, configMtime);

    const currentStat = fs.statSync(configPath);
    expect(currentStat.size).toBe(previousSnapshot.size);
    expect(currentStat.mtimeMs).toBe(previousSnapshot.mtimeMs);

    manager.handleProjectConfigChange(configPath);
    jest.advanceTimersByTime(manager.CONFIG_CHANGED_DELAY * 1000);

    expect(manager.switchToProject).toHaveBeenCalledWith(projectDir, { force: true });
  });

  it('refreshes an inactive project index without activating it', () => {
    const activeProjectDir = path.join(projectDir, 'active-project');
    manager._pool.getActiveProjectDir.mockReturnValue(activeProjectDir);
    fs.writeFileSync(configPath, '[env]\nboard = esp32-s3\n');
    fs.utimesSync(configPath, new Date(), new Date(Date.now() + 2000));

    manager.handleProjectConfigChange(configPath);
    jest.advanceTimersByTime(manager.CONFIG_CHANGED_DELAY * 1000);

    expect(manager.switchToProject).not.toHaveBeenCalled();
    expect(manager._pool.getObserver).toHaveBeenCalledWith(projectDir);
    expect(
      manager._pool.getObserver.mock.results[0].value.rebuildIndex,
    ).toHaveBeenCalledWith({ force: true });
  });

  it('queues an inactive index refresh when another rebuild is in progress', () => {
    const activeProjectDir = path.join(projectDir, 'active-project');
    manager._pool.getActiveProjectDir.mockReturnValue(activeProjectDir);
    const observer = {
      rebuildIndex: jest.fn().mockReturnValueOnce(undefined).mockResolvedValue(),
    };
    manager._pool.getObserver.mockReturnValue(observer);
    fs.writeFileSync(configPath, '[env]\nboard = esp32-s3\n');
    fs.utimesSync(configPath, new Date(), new Date(Date.now() + 2000));

    manager.handleProjectConfigChange(configPath);
    jest.advanceTimersByTime(manager.CONFIG_CHANGED_DELAY * 1000);

    expect(observer.rebuildIndex).toHaveBeenCalledTimes(1);
    expect(manager._pendingConfigIndexRebuilds.has(projectDir)).toBe(true);

    manager.flushPendingConfigIndexRebuild(projectDir, observer);

    expect(observer.rebuildIndex).toHaveBeenCalledTimes(2);
    expect(manager._pendingConfigIndexRebuilds.has(projectDir)).toBe(false);
  });

  it('forces a reload when the active project configuration changes', () => {
    manager._pool.getActiveProjectDir.mockReturnValue(projectDir);
    fs.writeFileSync(configPath, '[env]\nboard = esp32-s3\n');
    fs.utimesSync(configPath, new Date(), new Date(Date.now() + 2000));

    manager.handleProjectConfigChange(configPath);
    jest.advanceTimersByTime(manager.CONFIG_CHANGED_DELAY * 1000);

    expect(manager.switchToProject).toHaveBeenCalledWith(projectDir, { force: true });
  });
});
