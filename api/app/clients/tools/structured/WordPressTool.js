const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');




class WordPressTool extends Tool {
  constructor(fields) {
    super();
    this.name = 'WordPressTool';
    this.description =
      'A tool to interact with WordPress. Supports creating posts with title, content, and status.';
    
    // Schema for validating input arguments
    this.schema = z.object({
      action: z.enum(['createPost']).describe('The action to perform on WordPress. Currently supported: createPost.'),
      title: z.string().min(1).describe('The title of the post.'),
      content: z.string().min(1).describe('The content of the post.'),
      status: z.enum(['draft', 'publish']).optional().describe('The status of the post. Defaults to draft.'),
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

  // Create a post on WordPress
  async createPost(token, title, content, status = 'draft') {


    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, content, status }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to create post: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  // Main function to handle tool actions
   async _call(args) {
 
    try {
      // Validate input against schema
      const validationResult = this.schema.safeParse(args);
      if (!validationResult.success) {
        return `Validation Error: ${JSON.stringify(validationResult.error.issues)}`;
      }

      const { action, title, content, status } = validationResult.data;

      // Check if the model returned a function call
      if (action === 'createPost') {
        // Authenticate and get the token
        const token = await this.getToken();

        // Create the post
        const post = await this.createPost(token, title, content, status || 'draft');

        // Return the success message
        return JSON.stringify({
          message: `Post created successfully`,
          postId: post.id,
          postTitle: post.title.rendered,
        });
      }

      // Unsupported action fallback
      return JSON.stringify({ error: `Unsupported action "${action}".` });
    } catch (error) {
      // Log and return the error
      console.error(error);
      return JSON.stringify({ error: error.message });
    }
  }


}

module.exports = WordPressTool;
