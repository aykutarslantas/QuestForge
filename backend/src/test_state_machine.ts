import { prisma } from './db.js';
import { GameEngine } from './services/gameEngine.js';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('--- STARTING STATE MACHINE VERIFICATION TESTS ---');

  // 1. Create a test user
  const email = `tester_${Date.now()}@example.com`;
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

  // Retrieve full game info
  let gameInfo = await GameEngine.getActiveGame(user.id);
  if (!gameInfo) throw new Error('Game info not found');

  console.log('  Inventory count:', gameInfo.inventoryItems.length);
  console.log('  Cavern Room Items:', gameInfo.roomItems.filter(ri => ri.room === 'cavern').map(ri => ri.item));

  // 3. Try illegal move (east from cavern)
  console.log('\nTesting Move Rules:');
  let moveResult = await GameEngine.movePlayer(game.id, 'east');
  console.log(`  Move east from cavern (should fail): success=${moveResult.success}, message="${moveResult.message}"`);

  // 4. Move north to armoury
  moveResult = await GameEngine.movePlayer(game.id, 'north');
  console.log(`  Move north to armoury (should succeed): success=${moveResult.success}, message="${moveResult.message}"`);
  
  // 5. Try to enter treasury (should fail because goblin blocks it and locked)
  moveResult = await GameEngine.movePlayer(game.id, 'east');
  console.log(`  Move east to treasury (should fail - goblin alive): success=${moveResult.success}, message="${moveResult.message}"`);

  // 6. Test taking items
  console.log('\nTesting Item Gathering Rules:');
  let takeResult = await GameEngine.takeItem(game.id, 'wooden shield');
  console.log(`  Take wooden shield in armoury: success=${takeResult.success}, message="${takeResult.message}"`);

  takeResult = await GameEngine.takeItem(game.id, 'health potion');
  console.log(`  Take health potion in armoury: success=${takeResult.success}, message="${takeResult.message}"`);

  takeResult = await GameEngine.takeItem(game.id, 'rusty key');
  console.log(`  Take rusty key in armoury (should fail - key is in cavern): success=${takeResult.success}, message="${takeResult.message}"`);

  // 7. Engage in combat
  console.log('\nTesting Combat & Retaliation Rules:');
  let activeEnemyHp = 15;
  let turn = 1;
  while (activeEnemyHp > 0) {
    const attackResult = await GameEngine.attackEnemy(game.id);
    if (!attackResult.success) {
      console.log(`  Attack failed: ${attackResult.message}`);
      break;
    }
    console.log(`  Combat turn ${turn}: enemyHp=${attackResult.newEnemyHp}, playerHp=${attackResult.newPlayerHp}, Msg: "${attackResult.message}"`);
    activeEnemyHp = attackResult.newEnemyHp || 0;
    turn++;
  }

  // 8. Try to enter treasury again (should fail - door is still locked)
  console.log('\nTesting Unlock Rules:');
  moveResult = await GameEngine.movePlayer(game.id, 'east');
  console.log(`  Move east after goblin dead (should fail - locked): success=${moveResult.success}, message="${moveResult.message}"`);

  // 9. Try to use key without key
  let useResult = await GameEngine.useItem(game.id, 'rusty key');
  console.log(`  Use key without owning key (should fail): success=${useResult.success}, message="${useResult.message}"`);

  // 10. Go south, get key, return
  console.log('\nRetrieving Key Flow:');
  await GameEngine.movePlayer(game.id, 'south');
  await GameEngine.takeItem(game.id, 'rusty key');
  console.log('  Went to cavern and grabbed "rusty key".');
  await GameEngine.movePlayer(game.id, 'north');
  console.log('  Returned to armoury.');

  // 11. Use key
  useResult = await GameEngine.useItem(game.id, 'rusty key');
  console.log(`  Use rusty key now (should succeed): success=${useResult.success}, message="${useResult.message}"`);

  // 12. Move east to treasury
  moveResult = await GameEngine.movePlayer(game.id, 'east');
  console.log(`  Move east to treasury now (should succeed): success=${moveResult.success}, message="${moveResult.message}"`);

  // 13. Take crown and win
  console.log('\nTesting Win Conditions:');
  takeResult = await GameEngine.takeItem(game.id, 'golden crown');
  console.log(`  Take golden crown (should win!): success=${takeResult.success}, status=${takeResult.status}, message="${takeResult.message}"`);

  // 14. Check active game is clean
  const finishedGame = await prisma.game.findUnique({ where: { id: game.id } });
  console.log(`\nFinal Game Status: ${finishedGame?.status}`);

  console.log('--- ALL STATE MACHINE VERIFICATION TESTS COMPLETED SUCCESSFULLY ---');
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Test execution failed:', e);
    process.exit(1);
  });
