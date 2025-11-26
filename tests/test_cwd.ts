
import * as pty from 'node-pty';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

async function test() {
    const shell = 'bash';
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env
    });

    console.log(`Spawned pty with PID: ${ptyProcess.pid}`);

    // Wait for shell to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Change directory
    const targetDir = '/tmp';
    ptyProcess.write(`cd ${targetDir}\r`);

    // Wait for command to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        const linkPath = `/proc/${ptyProcess.pid}/cwd`;
        const cwd = await fs.promises.readlink(linkPath);
        console.log(`CWD from /proc: ${cwd}`);
        
        if (cwd === targetDir) {
            console.log('SUCCESS: CWD matches target directory');
        } else {
            console.log(`FAILURE: CWD ${cwd} does not match target ${targetDir}`);
        }
    } catch (error) {
        console.error('Error reading /proc:', error);
    }

    ptyProcess.kill();
}

test().catch(console.error);
