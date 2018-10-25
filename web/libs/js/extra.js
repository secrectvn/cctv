var browserCheck = {}
browserCheck.forLastPass = function(){
  var lastpass = navigator.plugins['LastPass'];
  if (lastpass === undefined) {
    return false;
  }
  return true;
}
if(browserCheck.forLastPass){
    alert('It appears you are using LastPass. Be aware that LastPass is known to cause issues with the form fields.')
}
