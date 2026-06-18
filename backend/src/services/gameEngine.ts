import { prisma } from '../db.js';
import { GameStatus } from '@prisma/client';

export interface Room {
  id: string;
  name: string;
  description: string;
  exits: { [direction: string]: string };
}

export const WORLD_MAP: { [roomId: string]: Room } = {
  cavern: {
    id: 'cavern',
    name: 'The Whispering Cavern',
    description: 'A dark, damp cavern where the walls seem to whisper secrets. Water drips from the ceiling. A rusty key lies on the wet ground. The only exit is a heavy door to the north.',
    exits: { north: 'armoury' },
  },
  armoury: {
    id: 'armoury',
    name: 'The Abandoned Armoury',
    description: 'An old armoury littered with broken shields and rusted swords. A wooden shield lies in the corner, and a glowing health potion sits on a shelf. A fierce-looking Goblin Guard blocks the exit to the east.',
    exits: { south: 'cavern', east: 'treasury' },
  },
  treasury: {
    id: 'treasury',
    name: 'The Treasury',
    description: 'A small, stone-walled vault glowing with faint magical light. In the center, sitting on a velvet cushion, is the Golden Crown! Pick it up to win the game.',
    exits: { west: 'armoury' },
  },
};

export class GameEngine {
  /**
   * Resets/creates a new active game for the user and seeds the initial room items.
   */
  static async createGame(userId: string) {
    return await prisma.$transaction(async (tx) => {
      // Deactivate/fail any current active games
      await tx.game.updateMany({
        where: { userId, status: GameStatus.active },
        data: { status: GameStatus.lost },
      });

      // Create new game
      const game = await tx.game.create({
        data: {
          userId,
          status: GameStatus.active,
          hp: 20,
          maxHp: 20,
          location: 'cavern',
          enemyHp: 25,
          enemyMaxHp: 25,
          treasuryLocked: true,
        },
      });

      // Seed initial room items
      await tx.roomItem.createMany({
        data: [
          { gameId: game.id, room: 'cavern', item: 'rusty key', quantity: 1 },
          { gameId: game.id, room: 'armoury', item: 'wooden shield', quantity: 1 },
          { gameId: game.id, room: 'armoury', item: 'health potion', quantity: 1 },
          { gameId: game.id, room: 'treasury', item: 'golden crown', quantity: 1 },
        ],
      });

      // Write welcome turn
      await tx.turn.create({
        data: {
          gameId: game.id,
          role: 'gm',
          content: 'Welcome to QuestForge! You awaken in the dark, damp Whispering Cavern. A heavy wooden door lies to the north. On the wet ground, you see a rusty key. What do you do?',
        },
      });

      return game;
    });
  }

  /**
   * Fetches the latest game state for a user (active, won, or lost), or returns null if none exists.
   */
  static async getActiveGame(userId: string) {
    const game = await prisma.game.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryItems: {
          where: { quantity: { gt: 0 } }
        },
        roomItems: {
          where: { quantity: { gt: 0 } }
        },
        turns: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return game;
  }

  /**
   * Returns metadata about the current room, exits, and active enemy.
   */
  static getRoomInfo(location: string, enemyHp: number, enemyMaxHp: number, treasuryLocked: boolean) {
    const room = WORLD_MAP[location];
    if (!room) return null;

    let enemy = null;
    if (location === 'armoury' && enemyHp > 0) {
      enemy = {
        name: 'Goblin Guard',
        hp: enemyHp,
        maxHp: enemyMaxHp,
      };
    }

    let lock = null;
    if (location === 'armoury') {
      lock = {
        name: 'Treasury Door',
        isLocked: treasuryLocked,
      };
    }

    return {
      name: room.name,
      exits: Object.keys(room.exits),
      enemy,
      lock,
    };
  }

  /**
   * Validates and moves the player to a new room.
   */
  static async movePlayer(gameId: string, direction: string) {
    const dir = direction.toLowerCase().trim();
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUniqueOrThrow({
        where: { id: gameId },
        include: { inventoryItems: true },
      });

      if (game.status !== GameStatus.active) {
        return { success: false, message: 'Game is not active.' };
      }

      const currentRoom = WORLD_MAP[game.location];
      if (!currentRoom) {
        return { success: false, message: `Invalid location: ${game.location}` };
      }

      const destRoomId = currentRoom.exits[dir];
      if (!destRoomId) {
        return { success: false, message: `You cannot go ${dir} from here.` };
      }

      // Special check: moving east from armoury into treasury
      if (game.location === 'armoury' && destRoomId === 'treasury') {
        if (game.enemyHp > 0) {
          return { success: false, message: 'The goblin guard blocks the exit to the east. You must defeat it first!' };
        }
        if (game.treasuryLocked) {
          return { success: false, message: 'The treasury door is locked. You need to unlock it with a rusty key first.' };
        }
      }

      // Update location
      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: { location: destRoomId },
      });

      return {
        success: true,
        message: `Moved to ${WORLD_MAP[destRoomId].name}.`,
        location: destRoomId,
        game: updatedGame,
      };
    });
  }

  /**
   * Validates and picks up an item from the current room.
   */
  static async takeItem(gameId: string, itemName: string) {
    const item = itemName.toLowerCase().trim();
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });

      if (game.status !== GameStatus.active) {
        return { success: false, message: 'Game is not active.' };
      }

      // Find room item
      const roomItem = await tx.roomItem.findUnique({
        where: {
          gameId_room_item: {
            gameId,
            room: game.location,
            item,
          },
        },
      });

      if (!roomItem || roomItem.quantity <= 0) {
        return { success: false, message: `There is no "${itemName}" to pick up here.` };
      }

      // Decrement / remove room item
      if (roomItem.quantity === 1) {
        await tx.roomItem.delete({
          where: { id: roomItem.id },
        });
      } else {
        await tx.roomItem.update({
          where: { id: roomItem.id },
          data: { quantity: roomItem.quantity - 1 },
        });
      }

      // Add to inventory
      await tx.inventoryItem.upsert({
        where: {
          gameId_item: {
            gameId,
            item,
          },
        },
        create: {
          gameId,
          item,
          quantity: 1,
        },
        update: {
          quantity: { increment: 1 },
        },
      });

      let statusUpdate: GameStatus = game.status;
      let finalMessage = `Picked up the ${item}.`;

      // Win condition check: picked up golden crown
      if (item === 'golden crown') {
        statusUpdate = GameStatus.won;
        finalMessage = `Picked up the golden crown! You have won the game!`;
        await tx.game.update({
          where: { id: gameId },
          data: { status: GameStatus.won },
        });
      }

      return {
        success: true,
        message: finalMessage,
        item,
        status: statusUpdate,
      };
    });
  }

  /**
   * Validates and uses an item from player's inventory.
   */
  static async useItem(gameId: string, itemName: string) {
    const item = itemName.toLowerCase().trim();
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId } });

      if (game.status !== GameStatus.active) {
        return { success: false, message: 'Game is not active.' };
      }

      // Check if item in inventory
      const invItem = await tx.inventoryItem.findUnique({
        where: {
          gameId_item: {
            gameId,
            item,
          },
        },
      });

      if (!invItem || invItem.quantity <= 0) {
        return { success: false, message: `You do not have a "${itemName}" in your inventory.` };
      }

      if (item === 'health potion') {
        if (game.hp >= game.maxHp) {
          return { success: false, message: 'Your health is already full!' };
        }

        const healAmount = 10;
        const newHp = Math.min(game.hp + healAmount, game.maxHp);
        const actualHealed = newHp - game.hp;

        // Consume potion
        if (invItem.quantity === 1) {
          await tx.inventoryItem.delete({ where: { id: invItem.id } });
        } else {
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: invItem.quantity - 1 },
          });
        }

        // Apply healing
        const updatedGame = await tx.game.update({
          where: { id: gameId },
          data: { hp: newHp },
        });

        return {
          success: true,
          message: `You drank the health potion and recovered ${actualHealed} HP. Current HP: ${newHp}/${game.maxHp}.`,
          newHp,
          game: updatedGame,
        };
      }

      if (item === 'rusty key') {
        if (game.location !== 'armoury') {
          return { success: false, message: 'You try using the key, but there is nothing to unlock here. Maybe use it near the locked Treasury door?' };
        }
        if (!game.treasuryLocked) {
          return { success: false, message: 'The door to the treasury is already unlocked!' };
        }

        // Consume key
        if (invItem.quantity === 1) {
          await tx.inventoryItem.delete({ where: { id: invItem.id } });
        } else {
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: invItem.quantity - 1 },
          });
        }

        // Unlock treasury
        const updatedGame = await tx.game.update({
          where: { id: gameId },
          data: { treasuryLocked: false },
        });

        return {
          success: true,
          message: 'You insert the rusty key into the heavy iron door of the treasury. With a loud click, the lock turns. The door is now unlocked!',
          game: updatedGame,
        };
      }

      return { success: false, message: `You cannot use the "${itemName}" right now.` };
    });
  }

  /**
   * Validates and attacks the enemy in the current room.
   */
  static async attackEnemy(gameId: string) {
    return await prisma.$transaction(async (tx) => {
      const game = await tx.game.findUniqueOrThrow({
        where: { id: gameId },
        include: { inventoryItems: true },
      });

      if (game.status !== GameStatus.active) {
        return { success: false, message: 'Game is not active.' };
      }

      if (game.location !== 'armoury') {
        return { success: false, message: 'There is no enemy to attack here.' };
      }

      if (game.enemyHp <= 0) {
        return { success: false, message: 'The goblin guard has already been defeated.' };
      }

      // Calculate player damage: 3-5
      const playerDamage = Math.floor(Math.random() * 3) + 3;
      const newEnemyHp = Math.max(0, game.enemyHp - playerDamage);

      let enemyDamage = 0;
      let newPlayerHp = game.hp;
      let statusUpdate: GameStatus = game.status;
      let outcomeMessage = '';

      if (newEnemyHp > 0) {
        // Goblin retaliates: 4-7 damage
        const baseEnemyDamage = Math.floor(Math.random() * 4) + 4;
        const hasShield = game.inventoryItems.some((inv) => inv.item === 'wooden shield' && inv.quantity > 0);
        
        enemyDamage = hasShield ? Math.max(1, baseEnemyDamage - 3) : baseEnemyDamage;
        newPlayerHp = Math.max(0, game.hp - enemyDamage);

        if (newPlayerHp <= 0) {
          statusUpdate = GameStatus.lost;
          outcomeMessage = `You swing at the goblin dealing ${playerDamage} damage. The goblin (HP: ${newEnemyHp}) counterattacks, dealing ${enemyDamage} damage${hasShield ? ' (reduced by shield)' : ''} and landing a fatal blow. You have been defeated. Game Over.`;
        } else {
          outcomeMessage = `You attack the goblin and deal ${playerDamage} damage. The goblin (HP: ${newEnemyHp}) counterattacks, dealing ${enemyDamage} damage${hasShield ? ' (reduced by shield)' : ''}. Your HP is now ${newPlayerHp}/${game.maxHp}.`;
        }
      } else {
        // Goblin defeated
        outcomeMessage = `You slash at the goblin dealing a devastating ${playerDamage} damage. The goblin collapses to the ground, defeated! The path to the east is now clear.`;
      }

      // Update game record
      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: {
          enemyHp: newEnemyHp,
          hp: newPlayerHp,
          status: statusUpdate,
        },
      });

      return {
        success: true,
        message: outcomeMessage,
        playerDamage,
        enemyDamage,
        newEnemyHp,
        newPlayerHp,
        status: statusUpdate,
        game: updatedGame,
      };
    });
  }
}
