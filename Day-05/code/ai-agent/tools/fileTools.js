import fs from 'node:fs/promises';
import path from 'node:path';

const websiteWorkspace = path.resolve('generated-sites');

// Ensured directories exist before agents execute files
await fs.mkdir(websiteWorkspace, { recursive: true });

//Resolves the absolute path of a file and ensures it stays strictly within the boundaries of the designated sandboxed workspace folder.
function safePath(relativePath) {
  const resolved = path.resolve(websiteWorkspace, relativePath);
  // Security Check: Block access if the path attempts to escape the root directory
  if (resolved !== websiteWorkspace && !resolved.startsWith(`${websiteWorkspace}${path.sep}`)) {
    throw new Error('Access outside generated-sites workspace is strictly prohibited.');
  }
  return resolved;
}

export const createDirectory = async ({ path: relativePath }) => {
  try {
    await fs.mkdir(safePath(relativePath), { recursive: true });
    return `Directory created successfully: ${relativePath}`;
  } catch (error) {
    return `Failed to create directory: ${error.message}`;
  }
};

export const writeFile = async ({ path: relativePath, content }) => {
  try {
    const file = safePath(relativePath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, 'utf8');
    return `File written successfully: ${relativePath}`;
  } catch (error) {
    return `Failed to write file: ${error.message}`;
  }
};

export const readFile = async ({ path: relativePath }) => {
  try {
    return await fs.readFile(safePath(relativePath), 'utf8');
  } catch (error) {
    return `Failed to read file: ${error.message}`;
  }
};

export const listFiles = async ({ path: relativePath }) => {
  try {
    const directory = safePath(relativePath);
    try {
      await fs.access(directory);
    } catch {
      return `Directory does not exist: ${relativePath}`;
    }

    const files = [];
    async function walk(current) {
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const item = path.join(current, entry.name);
        files.push(path.relative(websiteWorkspace, item));
        if (entry.isDirectory()) await walk(item);
      }
    }
    await walk(directory);
    return files.join('\n');
  } catch (error) {
    return `Failed to list files: ${error.message}`;
  }
};
