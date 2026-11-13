// Authentication and account lookup are separate steps. A lookup failure must
// never sign out a valid Firebase session or masquerade as a new account.
export async function resolveSignedInAccount(user,loadUsername){
  if(!user?.uid)return {ok:false,error:'Sign-in did not return a session. Please try again.'};
  try{
    const username=await loadUsername(user.uid);
    return username?{ok:true,created:false,username}:{ok:true,needsUsername:true,user};
  }catch{
    return {ok:false,error:"Your sign-in succeeded, but Lumora couldn't load your profile. Check your connection and try signing in again. Your account has not been changed."};
  }
}
