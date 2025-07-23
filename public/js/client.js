document.getElementById('resetProductsButton').addEventListener('click', function () {
    const password = prompt('Digite a senha para resetar os produtos:');
    if (password) { 
        fetch('/resetProducts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
});
