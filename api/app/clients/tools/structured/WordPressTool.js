const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');

class WordPressTool extends Tool {
  constructor(fields) {
    super();
    this.name = 'WordPressTool';
    this.description =
      'A tool to interact with WordPress. Supports creating, listing, editing, and deleting posts or pages.';

    // Schema for validating input arguments
    this.schema = z.object({
      action: z.enum(['createPost', 'editPost', 'listCategories', 'listTags']).describe(
        'The action to perform on WordPress. Supported: createPost, editPost, listCategories, listTags.'
      ),
      postId: z.number().optional().describe('The ID of the post to edit. Required for editPost.'),
      title: z.string().min(1).optional().describe('The title of the post or page. Required for createPost and editPost.'),
      content: z.string().min(1).optional().describe('The content of the post or page. Required for createPost and editPost.'),
      status: z
        .enum(['draft', 'publish', 'future'])
        .optional()
        .describe("The status of the post. Can be 'draft', 'publish', or 'future' for scheduling."),
      type: z.enum(['post', 'page']).optional().describe("The type of content. Can be 'post' or 'page'. Defaults to 'post'."),
      tags: z.array(z.number()).optional().describe('An array of tag IDs to attach to the post.'),
      categories: z.array(z.number()).optional().describe('An array of category IDs to attach to the post.'),
      date: z.string().optional().describe('The scheduled date and time in ISO 8601 format. Required for scheduling.'),
    });

    // WordPress credentials
    this.baseUrl = fields.WORDPRESS_BASE_URL || process.env.WORDPRESS_BASE_URL;
    this.username = fields.WORDPRESS_USERNAME || process.env.WORDPRESS_USERNAME;
    this.password = fields.WORDPRESS_PASSWORD || process.env.WORDPRESS_PASSWORD;

    if (!this.baseUrl || !this.username || !this.password) {
      throw new Error('WordPress credentials or base URL are missing.');
    }
  }

  // Authenticate with WordPress and get a token
  async getToken() {
    const response = await fetch(`${this.baseUrl}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Authentication failed: ${data.message || 'Unknown error'}`);
    }
    return data.token;
  }

  // Fetch posts from WordPress
  async listPosts(token) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  async createPost(token, title, content, status = 'draft', type = 'post', tags = [], categories = [], date = null) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/${type}s`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        content,
        status,
        tags,
        categories,
        date,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to create ${type}: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

 
  async editPost(token, postId, title, content, status = 'draft', tags = [], categories = []) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, content, status, tags, categories }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to edit post: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

 
  async deletePost(token, postId) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to delete post: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  async listCategories(token) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/categories`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  async listTags(token) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/tags`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  // Main function to handle tool actions
  async _call(args) {
    try {
      const validationResult = this.schema.safeParse(args);
      if (!validationResult.success) {
        return `Validation Error: ${JSON.stringify(validationResult.error.issues)}`;
      }

      
      const { action, title, content, status, type, tags, categories, postId, date } = validationResult.data;

      const token = await this.getToken();

      switch (action) {
        case 'listPosts': {
          const posts = await this.listPosts(token);
          return JSON.stringify(posts.map((post) => ({ id: post.id, title: post.title.rendered })));
        }
        case 'createPost': {
          if (!title || !content) {
            return JSON.stringify({ error: 'Title and content are required for creating a post or page.' });
          }
          const result = await this.createPost(token, title, content, status || 'draft', type || 'post', tags || [], categories || [], date);
          return JSON.stringify({
            message: `${type} created successfully`,
            id: result.id,
            title: result.title.rendered,
          });
        }
        case 'editPost': {
          if (!postId) {
            return JSON.stringify({ error: 'postId is required for editing a post or page.' });
          }
          const result = await this.editPost(token, postId, title, content, status || 'draft', tags || [], categories || []);
          return JSON.stringify({
            message: 'Post updated successfully',
            id: result.id,
            title: result.title.rendered,
          });
        }
        case 'deletePost': {
          if (!postId) {
            return 'Error: postId is required for deleting a post.';
          }
          const response = await this.deletePost(token, postId);
          return JSON.stringify({ message: 'Post deleted successfully', postId: response.id });
        }
        case 'listCategories': {
          const categories = await this.listCategories(token);
          return JSON.stringify(categories);
        }
        case 'listTags': {
          const tags = await this.listTags(token);
          return JSON.stringify(tags);
        }
        default:
          return JSON.stringify({ error: `Unsupported action "${action}".` });
      }
    } catch (error) {
      console.error(error);
      return JSON.stringify({ error: error.message });
    }
  }
}

module.exports = WordPressTool;
