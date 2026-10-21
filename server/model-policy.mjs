export const ROLE_MODELS=Object.freeze({luna:'gpt-6-luna',sol:'gpt-6.1-sol'});
// No unverified prices: production stays disabled until policies are explicitly reviewed.
export const VERIFIED_MODEL_POLICIES=Object.freeze({});
export function validateModelPolicy(policy,role){
 if(!Object.hasOwn(ROLE_MODELS,role)||!policy||policy.role!==role||policy.model!==ROLE_MODELS[role]||policy.verified!==true||typeof policy.source!=='string'||!policy.source.trim()||policy.source.length>500||!Number.isSafeInteger(policy.reserveCents)||policy.reserveCents<1||policy.reserveCents>500)throw Error('Verified model billing policy required');
 if(!policy.prices||!['input','output'].every(k=>Number.isFinite(policy.prices[k])&&policy.prices[k]>=0))throw Error('Invalid model prices');
 // Conservative byte-based input ceiling and fixed output ceiling.
 if((65536*policy.prices.input+4096*policy.prices.output)/1e6>policy.reserveCents/100)throw Error('Model reservation does not cover bounded payload cost');
 return {role,model:policy.model,verified:true,source:policy.source,reserveCents:policy.reserveCents,prices:{input:policy.prices.input,output:policy.prices.output}};
}
