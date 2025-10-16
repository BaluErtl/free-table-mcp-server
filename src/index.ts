import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Base API URL for FreeTable
const FREETABLE_API_BASE = "https://free-table-mcp-server.balu-ertl.workers.dev";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "FreeTable Restaurant Booking",
		version: "1.0.0",
	});

	async init() {
		// Restaurant listing tool for FreeTable API
		this.server.tool("get_restaurants", {}, async () => {
			try {
				const response = await fetch(`${FREETABLE_API_BASE}/api/restaurants`);

				if (!response.ok) {
					return {
						content: [
							{
								type: "text",
								text: `Error fetching restaurants: ${response.status} ${response.statusText}`,
							},
						],
					};
				}

				const data = await response.json();
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(data, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error fetching restaurants: ${error instanceof Error ? error.message : "Unknown error"}`,
						},
					],
				};
			}
		});

		// Restaurant booking tool for FreeTable API
		this.server.tool(
			"create_booking",
			{
				restaurantId: z.number().describe("ID of the restaurant to book"),
				tableId: z.number().describe("ID of the table to book"),
				customerName: z.string().describe("Customer's full name"),
				customerEmail: z.string().email().describe("Customer's email address"),
				customerPhone: z.string().describe("Customer's phone number"),
				bookingDate: z.string().describe("Booking date in YYYY-MM-DD format"),
				bookingTime: z.string().describe("Booking time in HH:MM format (24-hour)"),
				partySize: z.number().describe("Number of people in the party"),
				specialRequests: z.string().optional().describe("Any special requests for the booking"),
			},
			async ({
				restaurantId,
				tableId,
				customerName,
				customerEmail,
				customerPhone,
				bookingDate,
				bookingTime,
				partySize,
				specialRequests,
			}) => {
				try {
					const response = await fetch(`${FREETABLE_API_BASE}/api/bookings`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							restaurantId,
							tableId,
							customerName,
							customerEmail,
							customerPhone,
							bookingDate,
							bookingTime,
							partySize,
							specialRequests: specialRequests || "",
						}),
					});

					if (!response.ok) {
						const errorText = await response.text();
						return {
							content: [
								{
									type: "text",
									text: `Error creating booking: ${response.status} ${response.statusText}\nDetails: ${errorText}`,
								},
							],
						};
					}

					const data = await response.json();
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(data, null, 2),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error creating booking: ${error instanceof Error ? error.message : "Unknown error"}`,
							},
						],
					};
				}
			}
		);

		// Update booking tool for FreeTable API
		this.server.tool(
			"update_booking",
			{
				bookingId: z.number().describe("ID of the booking to update"),
				customerName: z.string().optional().describe("Updated customer name"),
				customerEmail: z.string().email().optional().describe("Updated customer email"),
				bookingDate: z.string().optional().describe("New booking date in YYYY-MM-DD format"),
				bookingTime: z.string().optional().describe("New booking time in HH:MM format (24-hour)"),
				partySize: z.number().optional().describe("New party size"),
				specialRequests: z.string().optional().describe("Updated special requests for the booking"),
				tableId: z.number().optional().describe("New table ID (if changing table)"),
			},
			async ({
				bookingId,
				customerName,
				customerEmail,
				bookingDate,
				bookingTime,
				partySize,
				specialRequests,
				tableId,
			}) => {
				try {
					// First, get the current booking to merge with updates
					const getResponse = await fetch(
						`${FREETABLE_API_BASE}/api/bookings/${bookingId}`
					);

					if (!getResponse.ok) {
						return {
							content: [
								{
									type: "text",
									text: `Error fetching booking: ${getResponse.status} ${getResponse.statusText}`,
								},
							],
						};
					}

					const currentData = (await getResponse.json()) as { booking: any };
					const currentBooking = currentData.booking;

					// Prepare update payload with only the fields that are provided
					const updatePayload: any = {};

					if (customerName !== undefined)
						updatePayload.customerName = customerName;
					if (customerEmail !== undefined)
						updatePayload.customerEmail = customerEmail;
					if (bookingDate !== undefined)
						updatePayload.bookingDate = bookingDate;
					if (bookingTime !== undefined)
						updatePayload.bookingTime = bookingTime;
					if (partySize !== undefined) updatePayload.partySize = partySize;
					if (specialRequests !== undefined)
						updatePayload.specialRequests = specialRequests;
					if (tableId !== undefined) updatePayload.tableId = tableId;

					const response = await fetch(
						`${FREETABLE_API_BASE}/api/bookings/${bookingId}`,
						{
							method: "PUT",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify(updatePayload),
						}
					);

					if (!response.ok) {
						const errorText = await response.text();
						return {
							content: [
								{
									type: "text",
									text: `Error updating booking: ${response.status} ${response.statusText}\nDetails: ${errorText}`,
								},
							],
						};
					}

					const data = await response.json();
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(data, null, 2),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error updating booking: ${error instanceof Error ? error.message : "Unknown error"}`,
							},
						],
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
