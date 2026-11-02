const tasks = [];

export function createTask(title) {
  tasks.push(title);
  return `Task created: ${title}`;
}

export function listTasks() {
  return [...tasks];
}

export function completeTask(title) {
  const index = tasks.indexOf(title);

  if (index !== -1) {
    tasks.splice(index, 1);
    return `Task completed: ${title}`;
  }

  return `Task not found: ${title}`;
}