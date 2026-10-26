/**
 * Unit tests for src/main.js
 */

import { extension } from './main';
import vscode from 'vscode';

jest.mock('vscode', () => jest.requireActual('../__mocks__/vscode'));

describe('getConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: jest.fn((id) => {
        if (id === 'testKey') {
          return 'testValue';
        }
        return undefined;
      }),
    });
  });

  it('gets configuration without resourceUri', () => {
    const result = extension.getConfiguration('testKey');
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(
      'platformio-ide',
      undefined,
    );
    expect(result).toBe('testValue');
  });

  it('gets configuration with resourceUri', () => {
    const mockUri = vscode.Uri.file('/workspace/project');
    const result = extension.getConfiguration('testKey', mockUri);
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(
      'platformio-ide',
      mockUri,
    );
    expect(result).toBe('testValue');
  });
});

describe('getProjectConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vscode.workspace.getConfiguration = jest.fn().mockReturnValue({
      get: jest.fn((id) => {
        if (id === 'testKey') {
          return 'projectValue';
        }
        return undefined;
      }),
    });
  });

  it('creates Uri from project directory and gets configuration', () => {
    const projectDir = '/workspace/project';
    const result = extension.getProjectConfiguration('testKey', projectDir);

    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(
      'platformio-ide',
      expect.any(Object),
    );
    expect(result).toBe('projectValue');
  });
});
