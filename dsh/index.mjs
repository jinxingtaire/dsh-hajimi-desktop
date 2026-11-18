import {DesktopRuntime} from './runtime.mjs';
export const name='hajimi-desktop';
export const inject=[];
/** Own the transparent desktop companion for this DSH plugin lifetime. */
export async function apply(ctx){
  const logger=ctx.logger('hajimi-desktop');
  const runtime=new DesktopRuntime({logger});
  ctx.effect(()=>()=>runtime.stop());
  await runtime.start();
}
