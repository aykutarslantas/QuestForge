import { prisma } from './db.js';
import { GameEngine } from './services/gameEngine.js';
import { GameStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function runDeathTest() {
  console.log('--- STARTING DEATH SCENARIO TEST ---');

  // 1. Create a test user
  const email = `death_tester_${Date.now()}@example.com`;
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });
  console.log(`✓ Created test user: ${email}`);

  // 2. Start new game
  let game = await GameEngine.createGame(user.id);
  console.log('✓ Started new game. Initial state:');
  console.log(`  Location: ${game.location}, HP: ${game.hp}/${game.maxHp}, Status: ${game.status}`);

  // 3. Move north to armoury (without picking up the key or shield)
  let moveResult = await GameEngine.movePlayer(game.id, 'north');
  console.log(`✓ Move north to armoury: success=${moveResult.success}, message="${moveResult.message}"`);
  
  // 4. Repeatedly attack goblin until player dies
  console.log('\nEngaging in combat without a shield...');
  let turn = 1;
  let isAlive = true;

  while (isAlive) {
    const attackResult = await GameEngine.attackEnemy(game.id);
    if (!attackResult.success) {
      console.log(`❌ Attack failed: ${attackResult.message}`);
      break;
    }
    
    console.log(`  [Turn ${turn}] Player HP: ${attackResult.newPlayerHp}/${game.maxHp} | Goblin HP: ${attackResult.newEnemyHp} | Msg: "${attackResult.message}"`);
    
    if (attackResult.status === GameStatus.lost) {
      console.log('\n💀 PLAYER HAS DIED. Game over check passed!');
      isAlive = false;
    }
    turn++;
  }

  // 5. Try attacking again to confirm the action is blocked after death
  console.log('\nTesting post-death command rejection:');
  const postDeathAttack = await GameEngine.attackEnemy(game.id);
  console.log(`  Attack after death: success=${postDeathAttack.success}, message="${postDeathAttack.message}"`);

  console.log('--- DEATH SCENARIO TEST COMPLETED ---');
}

runDeathTest()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  });
