import * as core from './coreTools.js';
import * as files from './fileTools.js';

// Central schema mapping generator
function defineTool(name, description, properties) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties, required: Object.keys(properties) },
    },
  };
}

// 1. Tool manifests parsed by OpenAI schemas
export const chatTools = [
  defineTool('calculate', 'Performs arithmetic operations.', {
    operation: { type: 'string', description: 'add, subtract, multiply, divide, mod, power' },
    a: { type: 'number', description: 'First entry' },
    b: { type: 'number', description: 'Second entry' },
  }),
  defineTool('currentWeather', 'Fetches current live city weather.', {
    city: { type: 'string', description: 'Target City location' },
  }),
  defineTool('getExchangeRate', 'Gets conversion rate trends between 2 currencies.', {
    from: { type: 'string', description: 'Source code, ex: USD' },
    to: { type: 'string', description: 'Target code, ex: INR' },
  }),
];

export const websiteTools = [
  defineTool('createDirectory', 'Creates directories inside website sandbox.', {
    path: { type: 'string', description: 'Relative folder path' },
  }),
  defineTool('writeFile', 'Outputs code directly into modern web formats.', {
    path: { type: 'string', description: 'File pathway destination' },
    content: { type: 'string', description: 'Raw code snippet string' },
  }),
  defineTool('readFile', 'Parses existing files on disk.', {
    path: { type: 'string', description: 'Target document route' },
  }),
  defineTool('listFiles', 'Scans workspaces for structural file validations.', {
    path: { type: 'string', description: 'Target system context directory' },
  }),
];

// 2. Functional executable registry lookup map
export const toolRegistry = {
  calculate: core.calculate,
  currentWeather: core.currentWeather,
  getExchangeRate: core.getExchangeRate,
  createDirectory: files.createDirectory,
  writeFile: files.writeFile,
  readFile: files.readFile,
  listFiles: files.listFiles,
};
