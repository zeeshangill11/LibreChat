import { z } from 'zod';

/**
 * Enum for System Defined Roles
 */
export enum SystemRoles {
  /**
   * The Admin role
   */
  ADMIN = 'ADMIN',
  /**
   * The default user role
   */
  USER = 'USER',
}

/**
 * Enum for Permission Types
 */
export enum PermissionTypes {
  /**
   * Type for Prompt Permissions
   */
  PROMPTS = 'PROMPTS',
  /**
   * Type for Bookmark Permissions
   */
  BOOKMARKS = 'BOOKMARKS',
  /**
   * Type for Agent Permissions
   */
  AGENTS = 'AGENTS',
  /**
   * Type for Multi-Conversation Permissions
   */
  MULTI_CONVO = 'MULTI_CONVO',
}

/**
 * Enum for Role-Based Access Control Constants
 */
export enum Permissions {
  SHARED_GLOBAL = 'SHARED_GLOBAL',
  USE = 'USE',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  READ = 'READ',
  READ_AUTHOR = 'READ_AUTHOR',
  SHARE = 'SHARE',
}

export const promptPermissionsSchema = z.object({
  [Permissions.SHARED_GLOBAL]: z.boolean().default(false),
  [Permissions.USE]: z.boolean().default(true),
  [Permissions.CREATE]: z.boolean().default(true),
  // [Permissions.SHARE]: z.boolean().default(false),
});

export const bookmarkPermissionsSchema = z.object({
  [Permissions.USE]: z.boolean().default(true),
});

export const agentPermissionsSchema = z.object({
  [Permissions.SHARED_GLOBAL]: z.boolean().default(false),
  [Permissions.USE]: z.boolean().default(true),
  [Permissions.CREATE]: z.boolean().default(true),
  // [Permissions.SHARE]: z.boolean().default(false),
});

export const multiConvoPermissionsSchema = z.object({
  [Permissions.USE]: z.boolean().default(false),
});

export const roleSchema = z.object({
  name: z.string(),
  [PermissionTypes.PROMPTS]: promptPermissionsSchema,
  [PermissionTypes.BOOKMARKS]: bookmarkPermissionsSchema,
  [PermissionTypes.AGENTS]: agentPermissionsSchema,
  [PermissionTypes.MULTI_CONVO]: multiConvoPermissionsSchema,
});

export type TRole = z.infer<typeof roleSchema>;
export type TAgentPermissions = z.infer<typeof agentPermissionsSchema>;
export type TPromptPermissions = z.infer<typeof promptPermissionsSchema>;
export type TBookmarkPermissions = z.infer<typeof bookmarkPermissionsSchema>;
export type TMultiConvoPermissions = z.infer<typeof multiConvoPermissionsSchema>;

const defaultRolesSchema = z.object({
  [SystemRoles.ADMIN]: roleSchema.extend({
    name: z.literal(SystemRoles.ADMIN),
    [PermissionTypes.PROMPTS]: promptPermissionsSchema.extend({
      [Permissions.SHARED_GLOBAL]: z.boolean().default(true),
      [Permissions.USE]: z.boolean().default(true),
      [Permissions.CREATE]: z.boolean().default(true),
      // [Permissions.SHARE]: z.boolean().default(true),
    }),
    [PermissionTypes.BOOKMARKS]: bookmarkPermissionsSchema.extend({
      [Permissions.USE]: z.boolean().default(true),
    }),
    [PermissionTypes.AGENTS]: agentPermissionsSchema.extend({
      [Permissions.SHARED_GLOBAL]: z.boolean().default(true),
      [Permissions.USE]: z.boolean().default(true),
      [Permissions.CREATE]: z.boolean().default(true),
      // [Permissions.SHARE]: z.boolean().default(true),
    }),
    [PermissionTypes.MULTI_CONVO]: multiConvoPermissionsSchema.extend({
      [Permissions.USE]: z.boolean().default(true),
    }),
  }),
  [SystemRoles.USER]: roleSchema.extend({
    name: z.literal(SystemRoles.USER),
    [PermissionTypes.PROMPTS]: promptPermissionsSchema,
    [PermissionTypes.BOOKMARKS]: bookmarkPermissionsSchema,
    [PermissionTypes.AGENTS]: agentPermissionsSchema,
    [PermissionTypes.MULTI_CONVO]: multiConvoPermissionsSchema,
  }),
});

export const roleDefaults = defaultRolesSchema.parse({
  [SystemRoles.ADMIN]: {
    name: SystemRoles.ADMIN,
    [PermissionTypes.PROMPTS]: {},
    [PermissionTypes.BOOKMARKS]: {},
    [PermissionTypes.AGENTS]: {},
    [PermissionTypes.MULTI_CONVO]: {},
  },
  [SystemRoles.USER]: {
    name: SystemRoles.USER,
    [PermissionTypes.PROMPTS]: {},
    [PermissionTypes.BOOKMARKS]: {},
    [PermissionTypes.AGENTS]: {},
    [PermissionTypes.MULTI_CONVO]: {},
  },
});
