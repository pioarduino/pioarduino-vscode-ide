/**
 * Copyright (c) 2017-present PlatformIO <contact@platformio.org>
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import * as pioNodeHelpers from 'pioarduino-node-helpers';

import os from 'os';
import vscode from 'vscode';

export function disposeSubscriptions(subscriptions) {
  while (subscriptions.length) {
    subscriptions.pop().dispose();
  }
}

export async function notifyError(title, err) {
  const description = err.stack || err.toString();
  const ghbody = `# Description of problem
  Leave a comment...

  BEFORE SUBMITTING, PLEASE SEARCH FOR DUPLICATES IN
  - https://github.com/pioarduino/pioarduino-vscode-ide/issues?q=is%3Aissue+

  # Configuration

  VSCode: ${vscode.version}
  PIO IDE: v${getIDEVersion()}
  System: ${os.type()}, ${os.release()}, ${os.arch()}

  # Exception
  \`\`\`
  ${description}
  \`\`\`
  `;
  const reportUrl = pioNodeHelpers.misc.getErrorReportUrl(title, ghbody);

  let action = 'Report a problem';
  if (!reportUrl.includes('issues/new')) {
    action = 'Check available solutions';
  }

  const selected = await vscode.window.showErrorMessage(
    description.substring(0, 700) + '...',
    action,
  );
  if (selected === action) {
    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(reportUrl));
  }
  console.error(err);
}

export function getIDEManifest() {
  return vscode.extensions.getExtension('pioarduino.pioarduino-ide').packageJSON;
}

export function getIDEVersion() {
  return getIDEManifest().version;
}

export async function listCoreSerialPorts() {
  const script = `
import json
from platformio.public import list_serial_ports

print(json.dumps(list_serial_ports()))
    `;
  const output = await pioNodeHelpers.core.getCorePythonCommandOutput(['-c', script]);
  return JSON.parse(output.trim()).map((item) => {
    for (const key of ['description', 'hwid']) {
      if (item[key] === 'n/a') {
        item[key] = undefined;
      }
    }
    return item;
  });
}
