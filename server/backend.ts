import dotenv from "dotenv";
import express from "express";
import { Request, Response } from "express";
import OpenAI from "openai";
import { ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam } from "openai/resources";
import cors from "cors";
import { use_mcp_tool } from '@modelcontextprotocol/sdk/client';
dotenv.config();

// ==================== 类型定义 ====================
interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  location?: string;
}

type CalendarResponse =
  | { success: true; events: CalendarEvent[] }
  | { success: false; error: string };

type EventCreateResponse =
  | { success: true; eventId: string }
  | { success: false; error: string };

type EventUpdateResponse =
  | { success: true; updatedEvent: CalendarEvent }
  | { success: false; error: string };

type EventDeleteResponse =
  | { success: true; deletedEventId: string }
  | { success: false; error: string };

// ==================== AI 服务 ====================
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEKAI_API_KEY,
});

let currentConversation: (ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam)[] = [];
let naturalLanguageConversation: (ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam)[] = [];

// AI Function calling
async function queryAI(prompt: string) {
  if (currentConversation.length == 0) {
    currentConversation.push({
      role: 'system',
      content: `请严格按以下 JSON 格式响应（仅返回JSON，不要其他文本）：
    {
      "function_call": {
        "name": "list_events|create_event|update_event|delete_event",
        "arguments": {
          "calendar_id": "primary",
          "start_time": "2025-03-16T09:00:00Z",
          "end_time": "2025-03-16T17:00:00Z",
          "summary": "会议标题",
          "description": "会议描述",
          "location": "会议地点"
        }
      }
    }
    
    示例：
    问："查看今天的日程"
    答：{"function_call":{"name":"list_events","arguments":{"calendar_id":"primary"}}}
    
    问："创建下午2点的会议"
    答：{"function_call":{"name":"create_event","arguments":{"calendar_id":"primary","start_time":"2025-03-16T14:00:00Z","end_time":"2025-03-16T15:00:00Z","summary":"会议标题","description":"会议描述"}}}
    `,
    });
  }
  currentConversation.push({ role: 'user', content: prompt });

  const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: currentConversation,
      response_format:{'type': 'json_object'}
  });
  return completion.choices[0].message.content;
}

// AI natural language processing
async function getNaturalLanguageResponse(userPrompt: string, functionResult: any) {
  naturalLanguageConversation = [
    { 
      role: 'system', 
      content: '你是一个友好的日程助手。请根据用户的问题和系统返回的结果，用自然语言回复用户。不要返回JSON格式，使用正常对话语气。' 
    },
    { 
      role: 'user', 
      content: `用户问题: ${userPrompt}\n系统结果: ${JSON.stringify(functionResult)}` 
    }
  ];
  
  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: naturalLanguageConversation
  });
  return response.choices[0].message.content;
}

// ==================== Calendar 服务 ====================
async function listEvents(calendarId: string): Promise<CalendarResponse> {
  try {
    const response = await use_mcp_tool({
      server_name: "github.com/pashpashpash/google-calendar-mcp",
      tool_name: "list_events",
      arguments: {
        calendarId: calendarId,
        timeMin: new Date().toISOString()
      }
    });
    return { success: true, events: response.data.items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function createEvent(calendarId: string, event: {
  summary: string;
  description: string;
  start: string;
  end: string;
  location?: string;
}): Promise<EventCreateResponse> {
  try {
    const response = await use_mcp_tool({
      server_name: "github.com/pashpashpash/google-calendar-mcp",
      tool_name: "create-event",
      arguments: {
        calendarId: calendarId,
        ...event
      }
    });
    return { success: true, eventId: response.data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function updateEvent(
  calendarId: string,
  eventId: string,
  updates: {
    summary: string;
    description: string;
    start: string;
    end: string;
    location?: string;
  }
): Promise<EventUpdateResponse> {
  try {
    const response = await use_mcp_tool({
      server_name: "github.com/pashpashpash/google-calendar-mcp",
      tool_name: "update-event",
      arguments: {
        calendarId: calendarId,
        eventId: eventId,
        ...updates
      }
    });
    return { success: true, updatedEvent: response.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function deleteEvent(
  calendarId: string,
  eventId: string
): Promise<EventDeleteResponse> {
  try {
    const response = await use_mcp_tool({
      server_name: "github.com/pashpashpash/google-calendar-mcp",
      tool_name: "delete-event",
      arguments: {
        calendarId: calendarId,
        eventId: eventId
      }
    });
    return { success: true, deletedEventId: eventId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== Express 服务 ====================
const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

app.post("/api/query", async (req: Request, res: Response) => {
  const { message } = req.body;

  const aiResponse = await queryAI(message);
  console.log("AI Response:", aiResponse);

  if (!aiResponse) {
    throw new Error("No response from AI");
  }
  
  const jsonMatch = aiResponse.match(/{[\s\S]*}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }

  const jsonString = jsonMatch[0]
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/<think>[\s\S]*<\/think>/g, "")
    .replace(/^\s*/, "");

  const parsedResponse = JSON.parse(jsonString);

  if (parsedResponse?.function_call) {
    const { name, arguments: args } = parsedResponse.function_call;
    let functionResult;
    switch (name) {
      case "list_events":
        if (!args?.calendar_id) {
          res.status(400).json({ error: "Missing calendar_id" });
        }
        functionResult = await listEvents(args.calendar_id);
        break;

      case "create_event":
        if (!args?.calendar_id || !args?.start_time || !args?.end_time || !args?.summary) {
          res.status(400).json({ error: "Missing required parameters" });
        }
        functionResult = await createEvent(args.calendar_id, {
          summary: args.summary,
          description: args.description || "",
          start: args.start_time,
          end: args.end_time,
          location: args.location
        });
        break;

      case "update_event":
        if (!args?.calendar_id || !args?.event_id || !args?.summary) {
          res.status(400).json({ error: "Missing required parameters" });
        }
        functionResult = await updateEvent(args.calendar_id, args.event_id, {
          summary: args.summary,
          description: args.description || "",
          start: args.start_time,
          end: args.end_time,
          location: args.location
        });
        break;

      case "delete_event":
        if (!args?.calendar_id || !args?.event_id) {
          res.status(400).json({ error: "Missing required parameters" });
        }
        functionResult = await deleteEvent(args.calendar_id, args.event_id);
        break;

      default:
        res.status(400).json({ error: "Unsupported function" });
    }
    
    const naturalResponse = await getNaturalLanguageResponse(message, functionResult);
    res.json({
      data: functionResult,
      message: naturalResponse
    });

  } else {
    res.json({
      message: "请更明确地说明需求，例如：'查看今天的日程' 或 '创建下午2点的会议'",
    });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
