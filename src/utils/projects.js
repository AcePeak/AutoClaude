const fs = require('fs');
const path = require('path');
const { getProjectsFile, getSettingsFile, ensureDir, getAppDataDir } = require('./paths');

/**
 * Load projects from file
 */
function loadProjects() {
  const projectsFile = getProjectsFile();

  if (!fs.existsSync(projectsFile)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
    return data.projects || [];
  } catch (err) {
    console.error('Failed to load projects:', err.message);
    return [];
  }
}

/**
 * Save projects to file
 */
function saveProjects(projects) {
  const projectsFile = getProjectsFile();
  ensureDir(path.dirname(projectsFile));

  const data = { projects };
  fs.writeFileSync(projectsFile, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Add or update a project
 */
function registerProject(projectPath, name = null) {
  const projects = loadProjects();
  const projectName = name || path.basename(projectPath);

  const existingIndex = projects.findIndex(p => p.path === projectPath);
  const projectData = {
    path: projectPath,
    name: projectName,
    enabled: true,
    last_activity: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    projects[existingIndex] = projectData;
  } else {
    projects.push(projectData);
  }

  saveProjects(projects);
  return projectData;
}

/**
 * Remove a project
 */
function removeProject(projectPath) {
  let projects = loadProjects();
  projects = projects.filter(p => p.path !== projectPath);
  saveProjects(projects);
}

/**
 * Get enabled projects
 */
function getEnabledProjects() {
  return loadProjects().filter(p => p.enabled);
}

/**
 * Toggle project enabled status
 */
function toggleProject(projectPath, enabled) {
  const projects = loadProjects();
  const project = projects.find(p => p.path === projectPath);
  if (project) {
    project.enabled = enabled;
    saveProjects(projects);
  }
}

/**
 * Load global settings
 */
function loadSettings() {
  const settingsFile = getSettingsFile();
  const cpuCount = require('os').cpus().length;
  const defaultMaxExecutors = Math.max(1, Math.min(4, Math.floor(cpuCount / 2)));

  const defaults = {
    max_executors: defaultMaxExecutors,
    check_interval_seconds: 60
  };

  if (!fs.existsSync(settingsFile)) {
    return defaults;
  }

  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    return { ...defaults, ...saved };
  } catch (err) {
    return defaults;
  }
}

/**
 * Save global settings
 */
function saveSettings(settings) {
  const settingsFile = getSettingsFile();
  ensureDir(path.dirname(settingsFile));
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
}

module.exports = {
  loadProjects,
  saveProjects,
  registerProject,
  removeProject,
  getEnabledProjects,
  toggleProject,
  loadSettings,
  saveSettings
};
