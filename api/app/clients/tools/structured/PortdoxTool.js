const { Tool } = require("@langchain/core/tools");
const { z } = require("zod");
const axios = require("axios");
require("dotenv").config(); // Load .env variables

class PortdoxTool extends Tool {
  constructor() {
    super();
    this.name = "portdox_tool";
    this.description =
      "A tool to fetch and update load requests from Laravel API.";
    
    // ✅ Schema Definition
    this.schema = z.object({
      action: z.enum(["list_load_requests", "search_by_ref", "update_container"]).describe(
        "Specify 'list_load_requests' to fetch load requests, 'search_by_ref' to search by reference number, or 'update_container' to modify a container."
      ),
      page: z.number().optional().describe("Page number for pagination (default: 1)."),
      per_page: z.number().optional().describe("Number of results per page (default: 5)."),
      ref_number: z.string().optional().describe("Reference number for filtering "),
      container_number: z.string().optional().describe("Container number to update."),
      container_type: z.string().optional().describe("Updated container type."),
      seal_no_1: z.string().optional().describe("Updated first seal number."),
      seal_no_2: z.string().optional().describe("Updated second seal number."),
      empty_pickup_date: z.string().optional().describe("Updated empty pickup date."),
      full_return_date: z.string().optional().describe("Updated full return date."),
      booking_id: z.string().optional().describe("Updated booking ID."),
      container_status: z.string().optional().describe("Updated container status."),
      load_id: z.string().optional().describe("Updated load ID."),
    });

    // ✅ API Configurations
    this.laravelApiUrl = "https://login.portdox.com/api/list_load_requests";
    this.updateContainerApiUrl = "https://login.portdox.com/api/submit_temp_container";
    this.laravelAuthToken = "454541121asdf45adfa454f545";
  }

  // ✅ Fetch Load Requests from Laravel API
  async getLoadRequests({ page = 1, per_page = 5, ref_number = null }) {
    try {
      const params = {
        auth_token: this.laravelAuthToken,
        page,
        per_page,
      };

      if (ref_number) {
        params.ref_number = ref_number; // ✅ Only include if not null
      }

      const response = await axios.get(this.laravelApiUrl, { params });

      console.log("[DEBUG] Laravel API Response:", response.data);

      if (response.data.success) {
        return response.data.data.data
          .map((item) => `- Load ID: ${item.load_id} Ref: ${item.ref_number} | Total: ${item.total_cars}`)
          .join("\n");
      } else {
        return `❌ API Error: ${response.data.error}`;
      }
    } catch (error) {
      console.error("[ERROR] Laravel API Call Failed:", error);
      return `⚠️ Laravel API Error: ${error.message}`;
    }
  }

  // ✅ Search Load Requests by Reference Number
  async searchLoadRequest(ref_number) {
    return await this.getLoadRequests({ ref_number });
  }

  // ✅ Update Container Details
  async updateContainer(data) {
    if (!data.load_id) {
      return "❌ Error: Load ID is required for updating.";
    }

    try {
      const response = await axios.post(this.updateContainerApiUrl, {
        auth_token: this.laravelAuthToken,
        ...data,
      });

      return response.data.success
        ? `✅ Container ${data.container_number} updated successfully.`
        : `❌ Update Error: ${response.data.error}`;
    } catch (error) {
      return `⚠️ Update API Error: ${error.message}`;
    }
  }
  // ✅ Main Call Function
  async _call(args) {
    try {
      const {
        action,
        page,
        per_page,
        ref_number,
        container_number,
        container_type,
        seal_no_1,
        seal_no_2,
        empty_pickup_date,
        full_return_date,
        booking_id,
        container_status,
        load_id,
      } = this.schema.parse(args);

      if (action === "list_load_requests") {
        return await this.getLoadRequests({ page, per_page, ref_number });
      } else if (action === "search_by_ref") {
        if (!ref_number) {
          return "❌ Error: Reference number is required for searching.";
        }
        return await this.searchLoadRequest(ref_number);
      } else if (action === "update_container") {
        if (!container_number) {
          return "❌ Error: Container number is required for updating.";
        }
        return await this.updateContainer({
          container_number,
          container_type,
          seal_no_1,
          seal_no_2,
          empty_pickup_date,
          full_return_date,
          booking_id,
          container_status,
          load_id,
        });
      } else {
        return "❌ Error: Invalid action specified.";
      }
    } catch (error) {
      console.error("[ERROR] Plugin Call Failed:", error);
      return `⚠️ Plugin Error: ${error.message}`;
    }
  }
}

module.exports = PortdoxTool;
