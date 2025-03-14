import fetch from "node-fetch";
import dotenv from "dotenv";
import express from "express";
import { Request, Response } from "express";

dotenv.config();

// ==================== 类型定义 ====================
interface Order {
  status: string;
  address: string;
}

type OrderResponse =
  | { success: true; status: string; address: string }
  | { success: false; error: string };

type AddressChangeResponse =
  | { success: true; new_address: string }
  | { success: false; error: string };

// ==================== 订单服务 ====================
const orders: Record<string, Order> = {
  "123": { status: "Shipped", address: "123 Main St" },
  "456": { status: "Processing", address: "456 Elm St" },
};

// 独立检查物流函数
function checkShipping(orderId: string): OrderResponse {
  const order = orders[orderId];
  return order
    ? { success: true, ...order }
    : { success: false, error: "Order not found" };
}

// 独立修改地址函数
function changeShippingAddress(
  orderId: string,
  newAddress: string
): AddressChangeResponse {
  if (!orders[orderId]) {
    return { success: false, error: "Order not found" };
  }

  orders[orderId].address = newAddress;
  return { success: true, new_address: newAddress };
}

// ==================== AI 服务 ====================
const AI_API_URL =
  process.env.AI_API_URL || "http://10.0.0.168:8080/api/generate";

async function queryAI(prompt: string) {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-r1:14b",
      // 强化版提示词模板
      prompt: `请严格按以下 JSON 格式响应（仅返回JSON，不要其他文本）：
      {
        "function_call": {
          "name": "check_shipping|change_shipping_address",
          "arguments": {
            "order_id": "123",
            "new_address": "新地址（仅修改时需要）"
          }
        }
      }
      
      用户请求：${prompt}
      
      示例：
      问："查订单 123 状态"
      答：{"function_call":{"name":"check_shipping","arguments":{"order_id":"123"}}}
      
      问："修改订单 456 地址到 789 Oak St"
      答：{"function_call":{"name":"change_shipping_address","arguments":{"order_id":"456","new_address":"789 Oak St"}}}
      `,
      stream: false,
      options: {
        temperature: 0.3, // 降低随机性
      },
    }),
  });
  return response.json();
}

// ==================== Express 服务 ====================
const app = express();
app.use(express.json());

app.post("/api/query", async (req: Request, res: Response) => {
  const { message } = req.body;

  const aiResponse = await queryAI(message);
  console.log("Raw AI Response:", aiResponse.response);

  // 增强版 JSON 提取
  const jsonMatch = aiResponse.response.match(/{[\s\S]*}/); // 匹配第一个完整 JSON 对象
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }

  // 清理 JSON 字符串
  const jsonString = jsonMatch[0]
    .replace(/```json/g, "") // 去除 Markdown 代码块标记
    .replace(/```/g, "") // 去除可能的三反引号
    .replace(/<think>[\s\S]*<\/think>/g, "") // 去除思考过程
    .replace(/^\s*/, ""); // 去除开头空格

  const parsedResponse = JSON.parse(jsonString);

  if (parsedResponse?.function_call) {
    const { name, arguments: args } = parsedResponse.function_call;

    switch (name) {
      case "check_shipping":
        if (!args?.order_id) {
          res.status(400).json({ error: "Missing order_id" });
        }
        res.json(checkShipping(args.order_id));
        break;

      case "change_shipping_address":
        if (!args?.order_id || !args?.new_address) {
          res.status(400).json({ error: "Missing parameters" });
        }
        res.json(changeShippingAddress(args.order_id, args.new_address));
        break;

      default:
        res.status(400).json({ error: "Unsupported function" });
    }
  } else {
    res.json({
      message:
        "请更明确地说明需求，例如：'查询订单 123 状态' 或 '修改订单 456 地址到新地址'",
    });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
