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

  it('refreshes an inactive project index without activating it', () => {
    const activeProjectDir = path.join(projectDir, 'active-project');
    manager._pool.getActiveProjectDir.mockReturnValue(activeProjectDir);
    fs.writeFileSync(configPath, '[env]\nboard = esp32-s3\n');
    fs.utimesSync(configPath, new Date(), new Date(Date.now() + 2000));

    manager.handleProjectConfigChange(configPath);
    jest.advanceTimersByTime(manager.CONFIG_CHANGED_DELAY * 1000);

    expect(manager.switchToProject).not.toHaveBeenCalled();
    expect(manager._pool.getObserver).toHaveBeenCalledWith(projectDir);
    expect(manager._pool.getObserver.mock.results[0].value.rebuildIndex).toHaveBeenCalledWith(
      { force: true },
    );
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
