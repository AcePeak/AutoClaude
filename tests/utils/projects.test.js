const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock the paths module before requiring projects
jest.mock('../../src/utils/paths', () => {
  const path = require('path');
  const originalModule = jest.requireActual('../../src/utils/paths');
  return {
    ...originalModule,
    getAppDataDir: () => path.join(global.TEST_TEMP_DIR, 'AutoClaude'),
    getProjectsFile: () => path.join(global.TEST_TEMP_DIR, 'AutoClaude', 'projects.json'),
    getSettingsFile: () => path.join(global.TEST_TEMP_DIR, 'AutoClaude', 'settings.json')
  };
});

const { loadProjects, saveProjects, getEnabledProjects, loadSettings } = require('../../src/utils/projects');

describe('projects utils', () => {
  let testAppDataDir;

  beforeEach(() => {
    // Create test app data directory
    testAppDataDir = path.join(global.TEST_TEMP_DIR, 'AutoClaude');
    fs.mkdirSync(testAppDataDir, { recursive: true });
  });

  describe('loadProjects', () => {
    test('should return empty array when projects.json does not exist', () => {
      const projects = loadProjects();
      expect(projects).toEqual([]);
    });

    test('should load projects from valid projects.json', () => {
      const projectsData = {
        projects: [
          { name: 'Project 1', path: '/path/1', enabled: true },
          { name: 'Project 2', path: '/path/2', enabled: false }
        ]
      };
      
      const projectsFile = path.join(testAppDataDir, 'projects.json');
      fs.writeFileSync(projectsFile, JSON.stringify(projectsData));

      const projects = loadProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Project 1');
      expect(projects[1].enabled).toBe(false);
    });

    test('should return empty array for invalid JSON', () => {
      const projectsFile = path.join(testAppDataDir, 'projects.json');
      fs.writeFileSync(projectsFile, 'invalid json');

      const projects = loadProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('saveProjects', () => {
    test('should save projects to JSON file', () => {
      const projects = [
        { name: 'Test Project', path: '/test/path', enabled: true }
      ];

      saveProjects(projects);

      const projectsFile = path.join(testAppDataDir, 'projects.json');
      expect(fs.existsSync(projectsFile)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
      expect(saved.projects).toHaveLength(1);
      expect(saved.projects[0].name).toBe('Test Project');
    });
  });

  describe('getEnabledProjects', () => {
    test('should return only enabled projects', () => {
      const projects = [
        { name: 'Project 1', path: '/path/1', enabled: true },
        { name: 'Project 2', path: '/path/2', enabled: false },
        { name: 'Project 3', path: '/path/3', enabled: true }
      ];

      saveProjects(projects);
      const enabledProjects = getEnabledProjects();

      expect(enabledProjects).toHaveLength(2);
      expect(enabledProjects[0].name).toBe('Project 1');
      expect(enabledProjects[1].name).toBe('Project 3');
    });
  });

  describe('loadSettings', () => {
    test('should return default settings when file does not exist', () => {
      const settings = loadSettings();
      expect(settings).toHaveProperty('max_executors');
      expect(typeof settings.max_executors).toBe('number');
    });

    test('should load custom settings from file', () => {
      const customSettings = {
        max_executors: 2,
        check_interval_seconds: 30
      };

      const settingsFile = path.join(testAppDataDir, 'settings.json');
      fs.writeFileSync(settingsFile, JSON.stringify(customSettings));

      const settings = loadSettings();
      expect(settings.max_executors).toBe(2);
      expect(settings.check_interval_seconds).toBe(30);
    });
  });
});