const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');

class WordPressTool extends Tool {
  constructor(fields) {
    super();
    this.name = 'wordpresstool';
    this.description =
      'A tool to interact with WordPress. Supports creating, listing, editing, and deleting posts or pages.';

    // Schema for validating input arguments
     this.schema = z.object({
      action: z.enum([
        'createPost', 
        'editPost', 
        'listCategories', 
        'listTags', 
        'searchPosts', 
        'searchByMeta', 
        'updatePostMeta', 
        'updateCategory', 
        'updateTag', 
        'getPostMeta',
        'deletePostMeta',
        'listPaginatedPosts',
        'listPaginatedCategories',
        'listPaginatedTags',
        'getPostContentById',
        'getFeaturedImage',
        'addCategory',
        'deleteCategory',
        'addTag',
        'deleteTag'

      ]).describe(
        'The action to perform on WordPress.'
      ),
      postId: z.number().optional().describe('The ID of the post to edit or update meta.'),
      title: z.string().min(1).optional().describe('The title of the post or page.'),
      content: z.string().min(1).optional().describe('The content of the post or page.'),
      status: z.enum(['draft', 'publish', 'future']).optional().describe("The status of the post."),
      type: z.enum(['post', 'page']).optional().describe("The type of content. Defaults to 'post'."),
      tags: z.array(z.number()).optional().describe('An array of tag IDs to attach to the post.'),
      categories: z.array(z.number()).optional().describe('An array of category IDs to attach to the post.'),
      date: z.string().optional().describe('The scheduled date and time in ISO 8601 format.'),
      searchType: z.enum(['contains', 'starts_with', 'ends_with']).optional().describe("Search type for title or content."),
      searchValue: z.string().optional().describe('The value to search for in title or content.'),
      tagId: z.number().optional().describe('The ID of the tag to filter posts.'),
      categoryId: z.number().optional().describe('The ID of the category to filter posts.'),
      metaKey: z.string().optional().describe('The meta key to search or update.'),
      metaValue: z.string().optional().describe('The meta value to search or update.'),
      name: z.string().optional().describe('New name for category or tag for updateCategory or updateTag.'),
      description: z.string().optional().describe('New description for category or tag for updateCategory or updateTag.'),
      page: z.number().optional().default(1).describe('The page number for pagination.'),
      perPage: z.number().optional().default(20).describe('The number of posts per page.'),
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

 
  async editPost(token, postId, updatedFields) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts/${postId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedFields),
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

  async getCategoryIdByName(token, categoryName) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(categoryName)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch category ID for name "${categoryName}": ${data.message || 'Unknown error'}`);
    }

    // Return the first matching category's ID or null if no match
    return data.length > 0 ? data[0].id : null;
  }

  async getTagIdByName(token, tagName) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch tag ID for name "${tagName}": ${data.message || 'Unknown error'}`);
    }

    // Return the first matching tag's ID or null if no match
    return data.length > 0 ? data[0].id : null;
  }

  async searchPosts(token, searchType, searchValue, tagId, tagName, categoryId, categoryName, type = 'post') {
    const params = new URLSearchParams();

    // Handle searchType and searchValue
    if (searchType && searchValue) {
      if (searchType === 'contains') {
        params.append('search', searchValue);
      } else if (searchType === 'starts_with') {
        params.append('title', `${searchValue}*`);
      } else if (searchType === 'ends_with') {
        params.append('title', `*${searchValue}`);
      }
    }

    // Fetch tag ID if tagName is provided
    if (tagName) {
      tagId = await this.getTagIdByName(token, tagName);
      if (!tagId) {
        throw new Error(`No tag found with name "${tagName}".`);
      }
    }

    if (categoryName) {
      categoryId = await this.getCategoryIdByName(token, categoryName);
      if (!categoryId) {
        throw new Error(`No category found with name "${categoryName}".`);
      }
    }

    params.append('status', 'any'); 

    if (tagId) params.append('tags', tagId);
    if (categoryId) params.append('categories', categoryId);
    
    // Query posts or pages
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/${type}s?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to search posts: ${data.message || 'Unknown error'}`);
    }
    return data;
  }




  async searchByMeta(token, metaKey, metaValue, type = 'post') {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/${type}s?meta_key=${metaKey}&meta_value=${metaValue}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to search by meta: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  async updatePostMeta(token, postId, metaKey, metaValue) {
    const response = await fetch(`${this.baseUrl}/wp-json/custom/v1/update-meta/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        post_id: postId,
        meta_key: metaKey,
        meta_value: metaValue,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to update post meta: ${data.message || 'Unknown error'}`);
    }
    return data;
  }
  async getPostMeta(token, postId) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to fetch post meta: ${data.message || 'Unknown error'}`);
    }

    // Ensure meta is returned (requires functions.php customization)
    return data.meta ? data.meta : { error: 'Meta not available. Ensure it is exposed in the REST API.' };
  }

  async deletePostMeta(token, postId, metaKey) {
    const response = await fetch(`${this.baseUrl}/wp-json/custom/v1/delete-meta/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        post_id: postId,
        meta_key: metaKey,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to delete post meta: ${data.message || 'Unknown error'}`);
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


  async updateCategoryOrTag(token, id, name, description, type = 'categories') {
      const endpoint = type === 'categories' ? '/custom/v1/update-category/' : '/custom/v1/update-tag/';

      // Prepare the payload only with provided fields
      const payload = {};
      if (id) payload.id = id;
      if (name) payload.name = name;
      if (description) payload.description = description;

      // Ensure at least one field is provided for update
      if (Object.keys(payload).length < 2) {
          throw new Error(`At least one of name or description is required for updating ${type}.`);
      }

      const response = await fetch(`${this.baseUrl}/wp-json${endpoint}`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
          return {
              message: `${type === 'categories' ? 'Category' : 'Tag'} updated successfully`,
              id: data.id,
              name: data.name || null,
              description: data.description || null,
          };
      } else {
          throw new Error(`Failed to update ${type}: ${data.message || 'Unknown error'}`);
      }
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




  async addCategory(token, name, description) {
    const response = await fetch(`${this.baseUrl}/wp-json/custom/v1/add-category/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to add category: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  // Function to delete a category
  async deleteCategory(token, categoryId) {
    const response = await fetch(`${this.baseUrl}/wp-json/custom/v1/delete-category/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: categoryId
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to delete category: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  // Function to add a new tag
  async addTag(token, name, description) {
    const response = await fetch(`${this.baseUrl}/wp-json/custom/v1/add-tag/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to add tag: ${data.message || 'Unknown error'}`);
    }
    return data;
  }

  // Function to delete a tag
  async deleteTag(token, tagId) {
    const response = await fetch(`${this.baseUrl}/wp-json/custom/v1/delete-tag/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: tagId
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to delete tag: ${data.message || 'Unknown error'}`);
    }
    return data;
  }


  async listPaginatedPosts(token, page = 1, perPage = 20) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch paginated posts');
    }

    const data = await response.json();
    return data;
  }
  
  async listPaginatedCategories(token, page = 1, perPage = 20) {
      const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/categories?page=${page}&per_page=${perPage}`, {
          method: 'GET',
          headers: {
              Authorization: `Bearer ${token}`,
          },
      });

      if (!response.ok) {
          throw new Error('Failed to fetch paginated categories');
      }

      const data = await response.json();
      return data;
  }

  async listPaginatedTags(token, page = 1, perPage = 20) {
      const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/tags?page=${page}&per_page=${perPage}`, {
          method: 'GET',
          headers: {
              Authorization: `Bearer ${token}`,
          },
      });

      if (!response.ok) {
          throw new Error('Failed to fetch paginated tags');
      }

      const data = await response.json();
      return data;
  }

  async getPostContentById(token, postId) {
    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts/${postId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch post content');
    }

    const data = await response.json();
    return data.content.rendered;
  }

  async getFeaturedImage(token, postId) {
      const postResponse = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts/${postId}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
      });

      if (!postResponse.ok) {
          throw new Error('Failed to fetch post details');
      }

      const postData = await postResponse.json();

      if (!postData.featured_media) {
          return 'No featured image';
      }

      const mediaResponse = await fetch(`${this.baseUrl}/wp-json/wp/v2/media/${postData.featured_media}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
      });

      if (!mediaResponse.ok) {
          throw new Error('Failed to fetch featured image details');
      }

      const mediaData = await mediaResponse.json();

      return mediaData.guid && mediaData.guid.rendered
          ? mediaData.guid.rendered
          : 'No featured image available';
  }
  // Main function to handle tool actions
  async _call(args) {
    try {
      const validationResult = this.schema.safeParse(args);
      if (!validationResult.success) {
        return `Validation Error: ${JSON.stringify(validationResult.error.issues)}`;
      }
      
      const { action, title, content, status, type, tags, categories, postId, date, searchType, searchValue,tagId, tagName, categoryId, categoryName,  metaKey, metaValue, description, name, page, perPage} = validationResult.data;
      
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

            // Collect only provided fields to update
            let updatedFields = {};
            if (title) updatedFields.title = title;
            if (content) updatedFields.content = content;
            if (status) updatedFields.status = status;
            if (tags) updatedFields.tags = tags;
            if (categories) updatedFields.categories = categories;

            if (Object.keys(updatedFields).length === 0) {
                return JSON.stringify({ error: 'No fields provided for update.' });
            }

            const result = await this.editPost(token, postId, updatedFields);
            return JSON.stringify({
                message: 'Post updated successfully',
                id: result.id,
                updatedFields
            });
        }
        case 'deletePost': {
          if (!postId) {
            return 'Error: postId is required for deleting a post.';
          }
          const response = await this.deletePost(token, postId);
          return JSON.stringify({ message: 'Post deleted successfully', postId: response.id });
        }
        case 'searchPosts': {
          const posts = await this.searchPosts(token, searchType, searchValue, tagId, tagName, categoryId, categoryName, type || 'post');
          return JSON.stringify(posts.map((post) => ({ id: post.id, title: post.title.rendered })));
        }
        case 'listCategories': {
          const categories = await this.listCategories(token);
          return JSON.stringify(categories);
        }
        case 'listTags': {
          const tags = await this.listTags(token);
          return JSON.stringify(tags);
        }
        case 'searchByMeta': {
          if (!metaKey || !metaValue) {
            return JSON.stringify({ error: 'Meta key and value are required for searching.' });
          }
          const posts = await this.searchByMeta(token, metaKey, metaValue, type || 'post');
          return JSON.stringify(posts.map((post) => ({ id: post.id, title: post.title.rendered })));
        }
        case 'updatePostMeta': {
          if (!postId || !metaKey || !metaValue) {
            return JSON.stringify({ error: 'postId, metaKey, and metaValue are required for updating meta.' });
          }
          const result = await this.updatePostMeta(token, postId, metaKey, metaValue);
          return JSON.stringify({
            message: 'Post meta updated successfully',
            postId: result.id,
          });
        }
        case 'getPostMeta': {
          if (!postId) {
            return JSON.stringify({ error: 'postId is required to fetch post meta.' });
          }
          const meta = await this.getPostMeta(token, postId);
          return JSON.stringify({ postId, meta });
        }
        case 'deletePostMeta': {
          if (!postId || !metaKey ) {
            return JSON.stringify({ error: 'postId is required to fetch post meta.' });
          }
          const result = await this.deletePostMeta(token, postId,metaKey);
          return JSON.stringify({
            message: 'Post meta deleted successfully',
            postId: result.id,
          });
        }
       

        case 'updateCategory': {
          if (!categoryId) {
              return JSON.stringify({ error: 'categoryId is required.' });
          }
          
          if (!name && !description) {
              return JSON.stringify({ error: 'At least one of name or description is required.' });
          }

          try {
              const result = await this.updateCategoryOrTag(token, categoryId, name, description, 'categories');
              return JSON.stringify(result);
          } catch (error) {
              return JSON.stringify({ error: error.message });
          }
        }

        case 'updateTag': {
            if (!tagId) {
                return JSON.stringify({ error: 'tagId is required.' });
            }
            
            if (!name && !description) {
                return JSON.stringify({ error: 'At least one of name or description is required.' });
            }

            try {
                const result = await this.updateCategoryOrTag(token, tagId, name, description, 'tags');
                return JSON.stringify(result);
            } catch (error) {
                return JSON.stringify({ error: error.message });
            }
        }

        case 'addCategory':
          if (!name) return JSON.stringify({ error: 'Category name is required.' });
          const category = await this.addCategory(token, name, description);
          return JSON.stringify(category);
        
        case 'addTag':
          if (!name) return JSON.stringify({ error: 'Tag name is required.' });
          const tag = await this.addTag(token, name, description);
          return JSON.stringify(tag);
            
        case 'deleteCategory':
          if (!categoryId) return JSON.stringify({ error: 'Category ID is required.' });
          const deletedCategory = await this.deleteCategory(token, categoryId);
          return JSON.stringify(deletedCategory);

        

        case 'deleteTag':
          if (!tagId) return JSON.stringify({ error: 'Tag ID is required.' });
          const deletedTag = await this.deleteTag(token, tagId);
          return JSON.stringify(deletedTag);





        case 'listPaginatedPosts': {
          const posts = await this.listPaginatedPosts(token, page, perPage);
          return JSON.stringify(posts.map(post => ({ id: post.id, title: post.title.rendered })));
        }
        case 'getPostContentById': {
          if (!postId) return JSON.stringify({ error: 'postId is required' });
          const content = await this.getPostContentById(token, postId);
          return JSON.stringify({ postId, content });
        }
        case 'getFeaturedImage': {
          if (!postId) return JSON.stringify({ error: 'postId is required' });
          const imageUrl = await this.getFeaturedImage(token, postId);
          return JSON.stringify({ postId, imageUrl });
        }
        case 'listPaginatedCategories': {
            const categories = await this.listPaginatedCategories(token, page, perPage);
            return JSON.stringify(categories);
        }
        case 'listPaginatedTags': {
            const tags = await this.listPaginatedTags(token, page, perPage);
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
