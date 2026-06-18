import OpenAI from 'openai';
import { config } from '../config.js';
import { GameEngine } from './gameEngine.js';
import { Response } from 'express';
import { prisma } from '../db.js';

let openai: OpenAI | null = null;
let modelName = 'gemini-2.5-flash';

if (config.openaiApiKey) {
  openai = new OpenAI({ apiKey: config.openaiApiKey });
  modelName = 'gpt-4o-mini';
} else if (config.geminiApiKey) {
  openai = new OpenAI({
    apiKey: config.geminiApiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  });
  modelName = 'gemini-2.5-flash';
}
const SYSTEM_PROMPT = `
You are the Game Master (GM) for QuestForge, a dark-themed text adventure RPG.
The player will tell you their actions, and you must narrate what happens.

CRITICAL REF_AND_REFEREE RULE:
1. For every player action (e.g. "go north", "attack goblin", "take shield", "use potion"), you MUST call the corresponding tool first (move_player, attack_enemy, take_item, use_item).
2. You are ABSOLUTELY FORBIDDEN from deciding the outcome of any action, calculating damage/HP, moving the player, or declaring game over/victory on your own.
3. The server runs random calculations (e.g. random damage) that you cannot predict. Even if the player is at 1 HP, they might survive or defeat the enemy.
4. You must wait for the tool execution result, and then base your narration ENTIRELY on the returned values (e.g. success, message, newPlayerHp, newEnemyHp, status).
5. If the server status changes to "lost" or "won" in the tool result, only then narrate the game over or victory.

Available rooms:
1. cavern (The Whispering Cavern) - Starting room. Exits: north to 'armoury'. Contains 'rusty key'.
2. armoury (The Abandoned Armoury) - Exits: south to 'cavern', east to 'treasury'. Contains 'wooden shield', 'health potion'. Guarded by a Goblin (25 HP).
3. treasury (The Treasury) - Exits: west to 'armoury'. Contains 'golden crown' (the victory item). The door is locked.

Rules & Mechanics:
- Moving: To move to a new room, you must call move_player(direction).
- Items: To pick up an item, call take_item(item).
- Combat: To attack the goblin in the armoury, call attack_enemy().
- Using Items: To heal, call use_item("health potion"). To unlock the treasury door, call use_item("rusty key").

Narration guidelines:
- Keep description atmospheric, brief (1-3 sentences), and engaging.
- If a tool fails (success: false), narrate the failure and explain why it failed.
`;

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'move_player',
      description: 'Moves the player in a direction (north, south, east, west) from their current location.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['north', 'south', 'east', 'west'],
            description: 'The direction to move.',
          },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'take_item',
      description: 'Picks up an item from the current room and adds it to the inventory.',
      parameters: {
        type: 'object',
        properties: {
          item: {
            type: 'string',
            description: 'The name of the item to take (e.g., "rusty key", "wooden shield", "health potion", "golden crown").',
          },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'use_item',
      description: 'Uses or consumes an item from the player\'s inventory.',
      parameters: {
        type: 'object',
        properties: {
          item: {
            type: 'string',
            description: 'The name of the item to use (e.g., "rusty key", "health potion").',
          },
        },
        required: ['item'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attack_enemy',
      description: 'Attacks the enemy (goblin) in the current room.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export class AIService {
  static async runGameTurn(
    gameId: string,
    playerAction: string,
    historyTurns: any[],
    res: Response
  ) {
    if (!openai) {
      throw new Error('AI Provider not configured. Please check API keys.');
    }

    // 1. Build prompt history with simplified text content
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    for (const turn of historyTurns) {
      if (turn.role === 'player') {
        if (turn.content && turn.content.trim() !== '') {
          messages.push({ role: 'user', content: turn.content });
        }
      } else if (turn.role === 'gm') {
        // If this turn had tool calls, we MUST reconstruct them to prevent the LLM from learning to hallucinate
        if (turn.toolCalls && Array.isArray(turn.toolCalls) && turn.toolCalls.length > 0) {
          const tcs: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = turn.toolCalls.map((tc: any, index: number) => ({
            id: `call_recon_${turn.id}_${index}`,
            type: 'function',
            function: {
              name: tc.name || tc.function?.name || 'unknown',
              arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || tc.function?.arguments || {}),
            }
          }));
          
          // Push the assistant message with tool_calls
          messages.push({ role: 'assistant', content: '', tool_calls: tcs });
          
          // Push tool responses using the actual saved result from the DB
          for (let i = 0; i < tcs.length; i++) {
            const originalTc = turn.toolCalls[i];
            messages.push({ 
              role: 'tool', 
              tool_call_id: tcs[i].id, 
              content: JSON.stringify(originalTc.result || { success: true, note: "reconstructed" }) 
            });
          }
        }
        
        // Push the final narration
        if (turn.content && turn.content.trim() !== '') {
          messages.push({ role: 'assistant', content: turn.content });
        }
      }
    }

    // Ensure strict alternation of user and assistant/model roles (required by Gemini API)
    const cleanedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    for (const msg of messages) {
      if (msg.role === 'system') continue;
      
      const last = cleanedMessages[cleanedMessages.length - 1];
      if (last && last.role === msg.role) {
        if (msg.role === 'user') {
          last.content = (last.content as string) + '\n' + (msg.content as string);
        } else if (msg.role === 'assistant') {
          last.content = (last.content as string) + '\n' + (msg.content as string);
        }
      } else {
        cleanedMessages.push(msg);
      }
    }

    // Ensure the first non-system message is a user message
    const firstNonSystemIndex = cleanedMessages.findIndex((m) => m.role !== 'system');
    if (firstNonSystemIndex !== -1 && cleanedMessages[firstNonSystemIndex].role === 'assistant') {
      cleanedMessages.splice(firstNonSystemIndex, 0, {
        role: 'user',
        content: 'Start the game.',
      });
    }

    // Fetch the most up-to-date server state to keep the LLM completely synchronized
    const currentStatus = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        inventoryItems: { where: { quantity: { gt: 0 } } },
        roomItems: { where: { quantity: { gt: 0 } } }
      }
    });

    if (currentStatus) {
      cleanedMessages.push({
        role: 'system',
        content: `[CURRENT AUTHORITATIVE SERVER STATE]
- Player HP: ${currentStatus.hp}/${currentStatus.maxHp}
- Player Location: ${currentStatus.location}
- Goblin HP: ${currentStatus.enemyHp}
- Treasury Locked: ${currentStatus.treasuryLocked ? 'Yes' : 'No'}
- Inventory: ${currentStatus.inventoryItems.map(i => i.item).join(', ') || 'empty'}
- Available Items in current room: ${currentStatus.roomItems.filter(ri => ri.room === currentStatus.location).map(i => i.item).join(', ') || 'none'}
- Game Status: ${currentStatus.status}`
      });
    }

    // Add current player action with a very strong system reminder appended to it
    cleanedMessages.push({ 
      role: 'user', 
      content: `${playerAction}\n\n[SYSTEM REMINDER: You MUST call a tool (like attack_enemy) for this action if it changes state. DO NOT guess or calculate outcomes based on past narrations. Rely ONLY on the [CURRENT AUTHORITATIVE SERVER STATE] block above.]` 
    });

    // 2. Tool validation loop
    let loopCount = 0;
    const maxLoops = 5;
    const executedToolCalls: any[] = [];

    while (loopCount < maxLoops) {
      console.log(`[AI SERVICE] Loop ${loopCount} messages:`, JSON.stringify(cleanedMessages, null, 2));
      const response = await openai.chat.completions.create({
        model: modelName,
        messages: cleanedMessages,
        tools,
        tool_choice: 'auto',
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;

      // If no tool calls, we are ready to stream the final narration
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }

      // Add assistant message with tool calls to context
      cleanedMessages.push(assistantMessage);

      // Execute each tool call
      const toolResponses: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      for (const tc of assistantMessage.tool_calls) {
        const name = tc.function.name;
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (e) {
          args = {};
        }

        let result: any = { success: false, message: 'Invalid tool arguments.' };

        // Route tool calls to GameEngine
        try {
          if (name === 'move_player') {
            result = await GameEngine.movePlayer(gameId, args.direction || '');
          } else if (name === 'take_item') {
            result = await GameEngine.takeItem(gameId, args.item || '');
          } else if (name === 'use_item') {
            result = await GameEngine.useItem(gameId, args.item || '');
          } else if (name === 'attack_enemy') {
            result = await GameEngine.attackEnemy(gameId);
          }
        } catch (error: any) {
          result = { success: false, message: error.message || 'Error executing action.' };
        }

        // Record for DB turn persistence
        executedToolCalls.push({
          name,
          args,
          result,
        });

        toolResponses.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }

      // Add tool responses to context
      cleanedMessages.push(...toolResponses);
      loopCount++;
    }

    // 3. Final Narration & Streaming
    console.log(`[AI SERVICE] Final stream messages:`, JSON.stringify(cleanedMessages, null, 2));
    const stream = await openai.chat.completions.create({
      model: modelName,
      messages: cleanedMessages,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullNarration = '';

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullNarration += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // Send the done event
    res.write('data: [DONE]\n\n');
    res.end();

    // 4. Persist turns inside a database transaction
    await prisma.$transaction(async (tx) => {
      // Save player action
      await tx.turn.create({
        data: {
          gameId,
          role: 'player',
          content: playerAction,
        },
      });

      // Save GM response
      await tx.turn.create({
        data: {
          gameId,
          role: 'gm',
          content: fullNarration,
          toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
        },
      });
    });
  }
}
