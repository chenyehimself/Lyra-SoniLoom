import {createRoleProvider} from './model-provider.mjs';
import {VERIFIED_MODEL_POLICIES} from './model-policy.mjs';
import {createIntentService} from './intent.mjs';
import {createAI} from './ai.mjs';
import {AgentTurnService} from './agent-turn.mjs';
export function createAgentRuntime({key,budget,search,policies=VERIFIED_MODEL_POLICIES,fetchImpl=fetch}){
 const provider=createRoleProvider({key,budget,policies,fetchImpl});
 const intent=createIntentService({invokeLuna:({instructions,input,schema},options)=>provider.invoke('luna',{instructions,input:[{role:'user',content:JSON.stringify(input)}],max_output_tokens:4096,text:{format:{type:'json_schema',name:'intent_decision',strict:true,schema}}},options)});
 const sol=createAI({key,budget,roleProvider:provider,fetchImpl});
 const professional={decide:({intentRecord,context,candidates,round,lastSearch,remaining,librarySummaryConsent,reasoningEffort},options)=>sol.generate({prompt:intentRecord.originalText,scope:context.scope,project:context.projectFacts,history:[],reasoningEffort},{...options,libraryContext:librarySummaryConsent?{round,candidates,lastSearch}:null,professionalContext:{intentRecord,context,remaining,librarySummaryConsent}})};
 const service=new AgentTurnService({intent,professional,search});
 return {status:()=>provider.status(),async run(raw,options){if(!provider.status().configured)throw Error(provider.status().disabledReason);return {...await service.run(raw,options),budget:budget.status()};}};
}
