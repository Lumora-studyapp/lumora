// Private profile photos and publicly readable selected characters have separate access.
export async function loadProfileAppearance({loadProfile,loadCharacter,loadPhoto}){
  const [profile,character]=await Promise.allSettled([loadProfile(),loadCharacter()]);
  if(profile.status==='rejected'){
    if(String(profile.reason?.code||'').replace(/^firestore\//,'')!=='permission-denied')throw profile.reason;
    if(character.status==='rejected')throw character.reason;
    return {url:'',character:character.value};
  }
  if(profile.value.photo)return {url:await loadPhoto(),character:null};
  if(character.status==='rejected')throw character.reason;
  return {url:'',character:character.value};
}
