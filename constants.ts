import { TabDefinition } from './types';

export const WORKSPACE_TAB_ID = 'workspace_tab_main';
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';
export const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-002';

export const INITIAL_WORKSPACE_TAB: TabDefinition = {
  id: WORKSPACE_TAB_ID,
  title: 'Workspace',
  type: 'workspace',
};

export const MOCK_VIDEO_PLACEHOLDER_DIMENSIONS = {
  width: 640,
  height: 360,
};