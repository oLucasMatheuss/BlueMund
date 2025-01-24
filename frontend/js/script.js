document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('produto-form');
    const listaProdutos = document.getElementById('lista-produtos');
    const overlay = document.getElementById('overlay');
    const formPopup = document.getElementById('form-popup');
    const popupTitle = document.getElementById('popup-title');
    const estoqueStats = document.getElementById('estoque-stats');
    const alertasEstoque = document.getElementById('alertas-estoque');
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    const sections = document.querySelectorAll('.section');
    const caixaForm = document.getElementById('caixa-form');
    const carrinhoLista = document.getElementById('carrinho-lista');
    const carrinhoTotal = document.getElementById('carrinho-total');
    const relatorioOutput = document.getElementById('relatorio-output');
    const caixaPopup = document.getElementById('caixa-popup');
    const caixaInicialForm = document.getElementById('caixa-inicial-form');
    const caixaValorInicial = document.getElementById('caixa-valor-inicial');
    const caixaValorFinal = document.getElementById('caixa-valor-final');
    const caixaNumeroVendas = document.getElementById('caixa-numero-vendas');
    const historicoFechamentos = document.getElementById('historico-fechamentos');
    let editingId = null;
    let carrinho = [];
    let caixaAberto = false;
    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const content = document.querySelector('.content');
        sidebar.classList.toggle('minimized');
        if (sidebar.classList.contains('minimized')) {
            content.style.marginLeft = '70px';
            content.style.width = 'calc(100% - 60px)';
        } else {
            content.style.marginLeft = '270px';
            content.style.width = 'calc(100% - 250px)';
        }
    }
    
    function showSection(section) {
        document.querySelectorAll('.section').forEach(sec => {
            sec.classList.add('hidden');
        });
        document.getElementById(`${section}-section`).classList.remove('hidden');
    }
    
    function openForm(action) {
        document.getElementById('form-popup').style.display = 'block';
        document.getElementById('overlay').style.display = 'block';
        if (action === 'add') {
            document.getElementById('popup-title').textContent = 'Adicionar Produto';
            document.getElementById('submit-btn').textContent = 'Adicionar Produto';
        }
    }
    
    function closeForm() {
        document.getElementById('form-popup').style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
    }
    
    function openCaixaPopup() {
        document.getElementById('caixa-popup').style.display = 'block';
        document.getElementById('overlay').style.display = 'block';
    }
    
    function closeCaixaPopup() {
        document.getElementById('caixa-popup').style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
    }
    
    // Example functions for handling products, sales and reports can be added below

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const formData = new FormData(form);
        const produto = {
            codigo: formData.get('codigo'),
            descricao: formData.get('descricao'),
            quantidade: parseInt(formData.get('quantidade')),
            estoque_minimo: parseInt(formData.get('estoque_minimo')),
            valor_unitario: parseFloat(formData.get('valor_unitario'))
        };

        if (editingId) {
            fetch(`http://localhost:3000/api/produtos/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(produto)
            })
            .then(response => response.json())
            .then(data => {
                form.reset();
                closeForm();
                loadProdutos();
                loadEstatisticas();
                loadAlertas();
                editingId = null;
            })
            .catch(error => console.error('Erro ao editar produto:', error));
        } else {
            fetch('http://localhost:3000/api/produtos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(produto)
            })
            .then(response => response.json())
            .then(data => {
                form.reset();
                closeForm();
                loadProdutos();
                loadEstatisticas();
                loadAlertas();
            })
            .catch(error => console.error('Erro ao adicionar produto:', error));
        }
    });

    caixaForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const codigo = document.getElementById('caixa-codigo').value;
        const quantidade = parseInt(document.getElementById('caixa-quantidade').value);
        const desconto = parseFloat(document.getElementById('caixa-desconto').value) || 0;

        fetch(`http://localhost:3000/api/produtos/${codigo}`)
            .then(response => response.json())
            .then(data => {
                const produto = data.data;
                if (produto && produto.quantidade >= quantidade) {
                    const valorComDesconto = produto.valor_unitario * (1 - desconto / 100);
                    carrinho.push({ ...produto, quantidade, valorComDesconto });
                    atualizarCarrinho();
                } else {
                    alert('Produto não encontrado ou quantidade insuficiente no estoque.');
                }
            })
            .catch(error => console.error('Erro ao buscar produto:', error));
    });

    caixaInicialForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const caixaInicial = parseFloat(document.getElementById('caixa-inicial').value);

        fetch('http://localhost:3000/api/caixa-inicial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valor: caixaInicial })
        })
        .then(response => response.json())
        .then(data => {
            caixaValorInicial.textContent = caixaInicial.toFixed(2);
            caixaValorFinal.textContent = caixaInicial.toFixed(2);
            caixaNumeroVendas.textContent = '0';
            caixaAberto = true;
            closeCaixaPopup();
        })
        .catch(error => console.error('Erro ao salvar valor inicial do caixa:', error));
    });

    function atualizarCarrinho() {
        carrinhoLista.innerHTML = carrinho.map(item => `
            <li>
                <span>${item.descricao} (Código: ${item.codigo}) - ${item.quantidade} x R$${item.valorComDesconto.toFixed(2)}</span>
                <span>R$${(item.quantidade * item.valorComDesconto).toFixed(2)}</span>
            </li>
        `).join('');

        const total = carrinho.reduce((acc, item) => acc + item.quantidade * item.valorComDesconto, 0);
        carrinhoTotal.textContent = total.toFixed(2);
    }

    window.finalizarVenda = function() {
        if (!caixaAberto) {
            alert('O caixa não está aberto.');
            return;
        }

        const vendas = carrinho.map(item => ({
            codigo: item.codigo,
            quantidade: item.quantidade,
            valor_total: item.quantidade * item.valorComDesconto
        }));

        fetch('http://localhost:3000/api/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vendas)
        })
        .then(response => response.json())
        .then(data => {
            alert('Venda realizada com sucesso!');
            carrinho = [];
            atualizarCarrinho();
            loadProdutos();
            loadEstatisticas();
            loadAlertas();
            atualizarCaixa(vendas);
        })
        .catch(error => console.error('Erro ao finalizar venda:', error));
    }

    function atualizarCaixa(vendas) {
        const valorVendas = vendas.reduce((acc, venda) => acc + venda.valor_total, 0);
        const valorFinal = parseFloat(caixaValorFinal.textContent) + valorVendas;
        const numeroVendas = parseInt(caixaNumeroVendas.textContent) + vendas.length;

        caixaValorFinal.textContent = valorFinal.toFixed(2);
        caixaNumeroVendas.textContent = numeroVendas.toString();
    }

    function loadProdutos() {
        fetch('http://localhost:3000/api/produtos')
            .then(response => response.json())
            .then(data => {
                const produtos = data.data;
                listaProdutos.innerHTML = produtos.map(produto => `
                    <div class="produto-item">
                        <p>${produto.descricao} (Código: ${produto.codigo}) - Quantidade: ${produto.quantidade}, Estoque Mínimo: ${produto.estoque_minimo}, Valor Unitário: R$${produto.valor_unitario.toFixed(2)}</p>
                        <div>
                            <button class="edit" onclick="openForm('edit', ${produto.id}, '${produto.codigo}', '${produto.descricao}', ${produto.quantidade}, ${produto.estoque_minimo}, ${produto.valor_unitario})">Editar</button>
                            <button class="delete" onclick="deleteProduto(${produto.id})">Excluir</button>
                        </div>
                    </div>
                `).join('');
            })
            .catch(error => console.error('Erro ao buscar produtos:', error));
    }

    function loadEstatisticas() {
        fetch('http://localhost:3000/api/estatisticas')
            .then(response => response.json())
            .then(data => {
                const estatisticas = data.data;
                estoqueStats.innerHTML = `
                    <p>Total de Produtos Cadastrados: ${estatisticas.totalProdutos}</p>
                    <p>Quantidade Total de Produtos: ${estatisticas.totalQuantidade}</p>
                    <p>Valor Total do Estoque: R$${estatisticas.valorTotal.toFixed(2)}</p>
                `;
            })
            .catch(error => console.error('Erro ao buscar estatísticas:', error));
    }

    function loadAlertas() {
        fetch('http://localhost:3000/api/alertas')
            .then(response => response.json())
            .then(data => {
                const alertas = data.data;
                if (alertas.length > 0) {
                    alertasEstoque.innerHTML = alertas.map(alerta => `
                        <p>${alerta.descricao} (Código: ${alerta.codigo}) - Quantidade: ${alerta.quantidade}, Estoque Mínimo: ${alerta.estoque_minimo}</p>
                    `).join('');
                } else {
                    alertasEstoque.innerHTML = '<p>Não há alertas de estoque.</p>';
                }
            })
            .catch(error => console.error('Erro ao buscar alertas:', error));
    }

    window.openForm = function(action, id = null, codigo = '', descricao = '', quantidade = '', estoque_minimo = '', valor_unitario = '') {
        formPopup.style.display = 'block';
        overlay.style.display = 'block';
        if (action === 'add') {
            popupTitle.textContent = 'Adicionar Produto';
            document.getElementById('submit-btn').textContent = 'Adicionar Produto';
            form.reset();
            editingId = null;
        } else if (action === 'edit') {
            popupTitle.textContent = 'Editar Produto';
            document.getElementById('submit-btn').textContent = 'Salvar Alterações';
            document.getElementById('codigo').value = codigo;
            document.getElementById('descricao').value = descricao;
            document.getElementById('quantidade').value = quantidade;
            document.getElementById('estoque_minimo').value = estoque_minimo;
            document.getElementById('valor_unitario').value = valor_unitario;
            editingId = id;
        }
    }

    window.closeForm = function() {
        formPopup.style.display = 'none';
        overlay.style.display = 'none';
        form.reset();
        editingId = null;
    }

    window.deleteProduto = function(id) {
        if (confirm('Tem certeza que deseja excluir este produto?')) {
            fetch(`http://localhost:3000/api/produtos/${id}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                loadProdutos();
                loadEstatisticas();
                loadAlertas();
            })
            .catch(error => console.error('Erro ao excluir produto:', error));
        }
    };

    window.toggleSidebar = function() {
        sidebar.classList.toggle('minimized');
        if (sidebar.classList.contains('minimized')) {
            content.style.marginLeft = '60px';
            content.style.width = 'calc(100% - 60px)';
        } else {
            content.style.marginLeft = '250px';
            content.style.width = 'calc(100% - 250px)';
        }
    }

    window.showSection = function(section) {
        sections.forEach(sec => sec.classList.add('hidden'));
        document.getElementById(`${section}-section`).classList.remove('hidden');
    }

    window.gerarRelatorio = function(tipo) {
        fetch(`http://localhost:3000/api/relatorios/${tipo}`)
            .then(response => response.json())
            .then(data => {
                const relatorio = data.data;
                let reportHtml = `<h3>Relatório de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</h3>`;
                if (tipo === 'financeiro') {
                    reportHtml += `
                        <div class="report">
                            <p>Caixa Inicial: R$${data.caixaInicial.toFixed(2)}</p>
                            <p>Caixa Final: R$${data.valorFinal.toFixed(2)}</p>
                            <p>Total de Vendas: ${data.vendasCount}</p>
                            <pre>${JSON.stringify(relatorio, null, 2)}</pre>
                        </div>
                    `;
                } else {
                    reportHtml += `
                    <div class="report">
                        <pre>${JSON.stringify(relatorio, null, 2)}</pre>
                    </div>
                `;
            }
            relatorioOutput.innerHTML = reportHtml;
        })
        .catch(error => console.error('Erro ao gerar relatório:', error));
}

window.fecharDia = function() {
    if (!caixaAberto) {
        alert('O caixa não está aberto.');
        return;
    }

    fetch('http://localhost:3000/api/relatorios/financeiro')
        .then(response => response.json())
        .then(data => {
            const valorFinal = parseFloat(caixaValorFinal.textContent);
            const totalVendas = parseInt(caixaNumeroVendas.textContent);

            fetch('http://localhost:3000/api/fechamento-diario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valor_final: valorFinal, total_vendas: totalVendas })
            })
            .then(response => response.json())
            .then(data => {
                alert('Fechamento diário registrado com sucesso!');
                resetarTransacoes();
                loadFechamentosDiarios();
                caixaValorInicial.textContent = '0.00';
                caixaValorFinal.textContent = '0.00';
                caixaNumeroVendas.textContent = '0';
                caixaAberto = false;
            })
            .catch(error => console.error('Erro ao registrar fechamento diário:', error));
        })
        .catch(error => console.error('Erro ao obter relatório financeiro:', error));
}

function resetarTransacoes() {
    fetch('http://localhost:3000/api/resetar-transacoes', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        console.log('Transações resetadas com sucesso.');
    })
    .catch(error => console.error('Erro ao resetar transações:', error));
}

function loadFechamentosDiarios() {
    fetch('http://localhost:3000/api/fechamentos-diarios')
        .then(response => response.json())
        .then(data => {
            const fechamentos = data.data;
            const reportHtml = fechamentos.map(fechamento => {
                const dataFechamento = new Date(fechamento.data_fechamento).toLocaleDateString();
                return `
                    <div class="report">
                        <h4>Fechamento do Dia ${dataFechamento}</h4>
                        <p>Caixa Inicial: R$${fechamento.valor_inicial.toFixed(2)}</p>
                        <p>Caixa Final: R$${fechamento.valor_final.toFixed(2)}</p>
                        <p>Total de Vendas: ${fechamento.total_vendas}</p>
                    </div>
                `;
            }).join('');
            historicoFechamentos.innerHTML = reportHtml;
        })
        .catch(error => console.error('Erro ao obter fechamentos diários:', error));
}

window.openCaixaPopup = function() {
    caixaPopup.style.display = 'block';
    overlay.style.display = 'block';
}

window.closeCaixaPopup = function() {
    caixaPopup.style.display = 'none';
    overlay.style.display = 'none';
    caixaInicialForm.reset();
}

loadProdutos();
loadEstatisticas();
loadAlertas();
loadFechamentosDiarios();
});