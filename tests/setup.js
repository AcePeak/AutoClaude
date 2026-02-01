// Jest setup file
// This runs before each test

const fs = require('fs');
const path = require('path');
const os = require('os');

// Create temp directory for tests
global.TEST_TEMP_DIR = path.join(os.tmpdir(), 'autoclaude-tests-' + Date.now());

beforeEach(() => {
  // Ensure temp directory exists
  if (!fs.existsSync(global.TEST_TEMP_DIR)) {
    fs.mkdirSync(global.TEST_TEMP_DIR, { recursive: true });
  }
});

afterEach(() => {
  // Clean up temp directory
  if (fs.existsSync(global.TEST_TEMP_DIR)) {
    fs.rmSync(global.TEST_TEMP_DIR, { recursive: true, force: true });
  }
});

// Helper to create test project structure
global.createTestProject = (projectPath) => {
  const collabDir = path.join(projectPath, 'collaboration');
  const configDir = path.join(collabDir, '.autoclaude');
  
  fs.mkdirSync(collabDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(collabDir, 'queue'), { recursive: true });
  fs.mkdirSync(path.join(collabDir, 'executing'), { recursive: true });
  fs.mkdirSync(path.join(collabDir, 'completed'), { recursive: true });
  
  // Create basic config
  const config = {
    name: 'Test Project',
    created: new Date().toISOString()
  };
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config, null, 2));
  
  return {
    projectPath,
    collabDir,
    configDir
  };
};