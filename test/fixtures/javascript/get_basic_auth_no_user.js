fetch('http://localhost:28139/', {
  headers: {
    'Authorization': 'Basic ' + btoa(':some_password')
  }
});
