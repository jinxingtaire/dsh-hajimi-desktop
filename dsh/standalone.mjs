import {DesktopRuntime} from './runtime.mjs';
const runtime=new DesktopRuntime();
await runtime.start();
const stop=async()=>{await runtime.stop();process.exit(0);};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
runtime.child?.once('exit',stop);
