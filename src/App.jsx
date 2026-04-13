import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Home, 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  MessageCircle, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  X,
  LogOut,
  RefreshCw,
  Loader2,
  Lock,
  Mail,
  Building,
  Banknote,
  Undo2,
  Shield,
  Briefcase
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import logo from "./cedro_logo.png"

const WEBHOOK_URL = process.env.REACT_APP_N8N_WEBHOOK_URL;

const API_KEY = process.env.REACT_APP_N8N_API_KEY;

// Função auxiliar para injetar a segurança em todas as chamadas
const getHeaders = () => ({
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Authorization': API_KEY
});

// --- FORMATADORES ---
const formatCurrency = (centavos) => {
  return (Number(centavos || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatInputCurrency = (value) => {
  if (!value) return '';
  let num = value.toString().replace(/\D/g, '');
  if (num === '') return '';
  num = parseInt(num, 10).toString();
  if (num.length === 1) num = '00' + num;
  if (num.length === 2) num = '0' + num;
  const reais = num.slice(0, -2);
  const centavos = num.slice(-2);
  return `${Number(reais).toLocaleString('pt-BR')},${centavos}`;
};

const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = ('' + phone).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (match) {
    return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
  }
  return phone;
};

const formatCPF = (cpf) => {
  if (!cpf) return '';
  let v = String(cpf).replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return v;
};

const generateBillingLink = (client) => {
  const telefone = String(client.telefone || '').replace(/\D/g, '');
  const valorFormatado = formatCurrency(client.valor_centavos || client.valor || 0);
  const linkPagamento = client.checkout_url ? client.checkout_url : '(Link de pagamento ainda não gerado)';
  const msg = `Olá, *${client.nome}*! Tudo bem? 🌟\n\nSegue o link para o pagamento do seu aluguel referente a *${client.descricao}*.\n\n💰 *Valor:* ${valorFormatado}\n🔗 *Link seguro para pagamento:*\n${linkPagamento}\n\nQualquer dúvida, estou à disposição!`;
  return `https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`;
};

const printReceipt = (client) => {
  const valorFormatado = formatCurrency(client.valor_centavos || client.valor || 0);
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Recibo - ${client.nome}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
          .receipt-box { border: 2px dashed #cbd5e1; padding: 40px; border-radius: 12px; max-width: 700px; margin: 0 auto; background: #fff; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 28px; font-weight: bold; color: #1e293b; margin: 0; letter-spacing: 2px; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 5px; }
          .amount-box { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; color: #0f172a; margin: 20px 0; border: 1px solid #e2e8f0;}
          .content p { font-size: 16px; line-height: 1.8; margin-bottom: 15px; }
          .signature { text-align: center; margin-top: 60px; }
          .line { border-top: 1px solid #94a3b8; width: 300px; margin: 0 auto 10px auto; }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="header">
            <h1 class="title">RECIBO DE ALUGUEL</h1>
            <p class="subtitle">Gestão de Propriedades</p>
          </div>
          <div class="amount-box">
            VALOR: ${valorFormatado}
          </div>
          <div class="content">
            <p>Recebemos de <strong>${client.nome}</strong> (Ref: ${client.order_nsu || 'N/D'}), a quantia de <strong>${valorFormatado}</strong>, correspondente ao pagamento do aluguel do imóvel localizado em:</p>
            <p><strong>🏠 Imóvel:</strong> ${client.descricao}</p>
            <p>Pelo qual firmamos o presente recibo para que produza os seus devidos e legais efeitos.</p>
            <p><strong>📅 Data de Emissão:</strong> ${dataAtual}</p>
          </div>
          <div class="signature"><div class="line"></div><p>Assinatura do Locador</p></div>
        </div>
        <script>setTimeout(() => { window.print(); }, 500);<\/script>
      </body>
    </html>
  `);
  win.document.close();
};

const getPaymentInfo = (client) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  let strVal = String(client.dia_vencimento || client.vencimento || '').trim();
  let dia = NaN;
  if (strVal.includes('-')) dia = parseInt(strVal.split('-').pop(), 10);
  else if (strVal.includes('/')) dia = parseInt(strVal.split('/')[0], 10);
  else dia = parseInt(strVal, 10);
  if (isNaN(dia) || dia < 1 || dia > 31) dia = 1;

  const dueDateThisMonth = new Date(currentYear, currentMonth, dia);
  const dueDateNextMonth = new Date(currentYear, currentMonth + 1, dia);

  const diffThisMonth = Math.round((dueDateThisMonth - today) / (1000 * 60 * 60 * 24));
  const diffNextMonth = Math.round((dueDateNextMonth - today) / (1000 * 60 * 60 * 24));

  let diffDays = diffThisMonth;
  let targetDate = dueDateThisMonth;

  if (diffNextMonth <= 10 && diffThisMonth < 0) {
      diffDays = diffNextMonth;
      targetDate = dueDateNextMonth;
  }

  const targetMonthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  const statusAtual = String(client.atualizado_em || '').toUpperCase().trim();
  const isPaid = statusAtual.includes('PAGO') && statusAtual.includes(targetMonthStr);
  const isLate = diffDays < 0 && !isPaid;

  return { targetDate, diffDays, isPaid, isLate, targetMonthStr };
};

// --- COMPONENTE PRINCIPAL (GESTOR DE ESTADO DE AUTENTICAÇÃO) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Verifica se o utilizador já tem sessão iniciada
  useEffect(() => {
    const savedUser = localStorage.getItem('imob_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('imob_user');
      }
    }
    setIsCheckingAuth(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('imob_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    if(window.confirm('Tem a certeza que deseja terminar sessão?')) {
      setUser(null);
      localStorage.removeItem('imob_user');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  // Se não estiver autenticado, exibe o ecrã de Login
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ROTEAMENTO SAAS: Se for admin, vai para o painel de gestão de agências
  if (user.role === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  // Se for agência normal, exibe o Dashboard
  return <DashboardApp user={user} onLogout={handleLogout} />;
}

// --- ECRÃ DE LOGIN ---
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'login', email: email, senha: password })
      });

      if (!response.ok) throw new Error('Falha ao contactar o servidor.');

      const data = await response.json();
      
      const result = Array.isArray(data) ? data[0] : data;
      const resultData = result.json ? result.json : result;

      if (resultData.success && resultData.user) {
        onLogin(resultData.user);
      } else {
        setError(resultData.message || 'Credenciais inválidas ou utilizador inativo.');
      }
    } catch (err) {
      setError('Erro de ligação: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <img src={logo} alt="Cedro"  className='mx-auto w-24 h-16 mb-6 drop-shadow-md'/>
          </div>
          <h2 className="text-4xl font-black tracking-[-0.05em] text-slate-800">
  <span className="text-slate-900">Ce</span>
  <span className="bg-gradient-to-r from-[#14532D] to-[#15803D] bg-clip-text text-transparent">
    dro
  </span>
</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">Acesso restrito a colaboradores</p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Endereço de E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors bg-slate-50 focus:bg-white outline-none"
                  placeholder="admin@imobiliaria.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Palavra-passe</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors bg-slate-50 focus:bg-white outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : null}
            {isLoading ? 'A autenticar...' : 'Iniciar Sessão'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- PAINEL DO SUPER ADMIN (GESTAO DE AGÊNCIAS) ---
function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('agencias');
  const [imobiliarias, setImobiliarias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalState, setModalState] = useState({ imob: false, user: false });
  const [editingItem, setEditingItem] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${WEBHOOK_URL}?role=admin`, { 
        method: 'GET',
        headers: getHeaders() 
      });
      const data = await response.json();
      setImobiliarias(data.imobiliarias || []);
      setUsuarios(data.usuarios || []);
    } catch (error) {
      alert("Erro ao carregar dados do SaaS: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  const handleSaveImob = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const fd = new FormData(e.target);
    const imobData = Object.fromEntries(fd.entries());
    try {
      const payload = { 
        action: editingItem ? 'update_imob' : 'create_imob', 
        id: editingItem?.Id || editingItem?.id, 
        imobiliaria: imobData 
      };
      await fetch(WEBHOOK_URL, { 
        method: 'POST', 
        headers: getHeaders(), 
        body: JSON.stringify(payload) 
      });
      await fetchData();
      setModalState({ imob: false, user: false });
    } catch (err) { 
      alert("Erro: " + err.message); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const fd = new FormData(e.target);
    const userData = Object.fromEntries(fd.entries());
    try {
      const payload = { 
        action: editingItem ? 'update_user' : 'create_user', 
        id: editingItem?.Id || editingItem?.id, 
        usuario: userData 
      };
      await fetch(WEBHOOK_URL, { 
        method: 'POST', 
        headers: getHeaders(), 
        body: JSON.stringify(payload) 
      });
      await fetchData();
      setModalState({ imob: false, user: false });
    } catch (err) { 
      alert("Erro: " + err.message); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0 text-slate-300">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2 text-indigo-400">
            <img src={logo} alt="Cedro"  className='mx-auto w-14 h-14 br-5 drop-shadow-md rounded-xl'/>
            <h2 className="text-4xl font-black tracking-[-0.05em] text-slate-800">
  <span className="text-slate-900 text-white">Ce</span>
  <span className="bg-gradient-to-r from-[#14532D] to-[#15803D] bg-clip-text text-transparent">
    dro
  </span>
</h2>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          <button 
            onClick={() => setActiveTab('agencias')} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'agencias' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Briefcase size={18} /> Agências
          </button>
          <button 
            onClick={() => setActiveTab('usuarios')} 
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'usuarios' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Users size={18} /> Contas de Acesso
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-800">
            {activeTab === 'agencias' ? 'Gestão de Imobiliárias' : 'Gestão de Utilizadores'}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-slate-700">{user.nome} (Super Admin)</span>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors" title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {isLoading && imobiliarias.length === 0 ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
          ) : (
            <>
              {activeTab === 'agencias' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex justify-between">
                    <h2 className="font-bold text-slate-800">Imobiliárias Registadas no Sistema</h2>
                    <button onClick={() => { setEditingItem(null); setModalState({imob: true, user: false}); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
                      <Plus size={16} /> Nova Imobiliária
                    </button>
                  </div>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="px-6 py-3 font-semibold">ID / Nome</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {imobiliarias.map(i => (
                        <tr key={i.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{i.nome}</p>
                            <p className="text-xs text-slate-400">ID: {i.Id || i.id}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${String(i.ativo).toLowerCase() === 'sim' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {i.ativo}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => { setEditingItem(i); setModalState({imob: true, user: false}); }} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded">
                              <Edit2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'usuarios' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex justify-between">
                    <h2 className="font-bold text-slate-800">Utilizadores e Corretores</h2>
                    <button onClick={() => { setEditingItem(null); setModalState({imob: false, user: true}); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
                      <Plus size={16} /> Novo Utilizador
                    </button>
                  </div>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="px-6 py-3 font-semibold">Nome / Email</th>
                        <th className="px-6 py-3 font-semibold">Perfil</th>
                        <th className="px-6 py-3 font-semibold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usuarios.map(u => {
                        const imobName = imobiliarias.find(i => String(i.Id || i.id) === String(u.imobiliaria_id))?.nome || 'N/A';
                        return (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{u.nome}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {u.role}
                            </span>
                            {u.role !== 'admin' && <p className="text-xs text-slate-400 mt-1">Agência: {imobName}</p>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => { setEditingItem(u); setModalState({imob: false, user: true}); }} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded">
                              <Edit2 size={16}/>
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* MODAL IMOBILIARIA */}
      {modalState.imob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Dados da Imobiliária</h2>
            </div>
            <form id="imob-form" className="p-5 space-y-4" onSubmit={handleSaveImob}>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nome da Agência</label>
                <input required name="nome" defaultValue={editingItem?.nome} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">InfinitePay Token (API Key)</label>
                <input name="infinitepay_token" defaultValue={editingItem?.infinitepay_token} type="password" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Evolution Instance</label>
                  <input name="evolution_instance" defaultValue={editingItem?.evolution_instance} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Evolution API Key</label>
                  <input name="evolution_apikey" defaultValue={editingItem?.evolution_apikey} type="password" className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ativo?</label>
                <select name="ativo" defaultValue={editingItem?.ativo || 'sim'} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </form>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setModalState({imob: false, user: false})} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="submit" form="imob-form" disabled={isLoading} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded font-bold flex gap-2 items-center">
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL USUARIO */}
      {modalState.user && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Dados do Utilizador</h2>
            </div>
            <form id="user-form" className="p-5 space-y-4" onSubmit={handleSaveUser}>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nome</label>
                <input required name="nome" defaultValue={editingItem?.nome} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                <input required type="email" name="email" defaultValue={editingItem?.email} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Senha</label>
                <input required type="password" name="senha" defaultValue={editingItem?.senha} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Perfil</label>
                  <select name="role" defaultValue={editingItem?.role || 'agencia'} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <option value="agencia">Agência</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Vincular a Imobiliária</label>
                  <select name="imobiliaria_id" defaultValue={editingItem?.imobiliaria_id || ''} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    <option value="">Nenhuma (Apenas Admin)</option>
                    {imobiliarias.map(i => <option key={i.id} value={i.Id || i.id}>{i.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ativo?</label>
                <select name="ativo" defaultValue={editingItem?.ativo || 'sim'} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </form>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setModalState({imob: false, user: false})} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="submit" form="user-form" disabled={isLoading} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded font-bold flex gap-2 items-center">
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- DASHBOARD PRINCIPAL DA AGÊNCIA ---
function DashboardApp({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [allClients, setAllClients] = useState([]); 
  const [imoveis, setImoveis] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [modalState, setModalState] = useState({ client: false, imovel: false });
  const [editingClient, setEditingClient] = useState(null);
  const [editingImovel, setEditingImovel] = useState(null);

  const fetchClients = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // FILTRO SAAS NA URL DA REQUISIÇÃO
      const response = await fetch(`${WEBHOOK_URL}?imobiliaria_id=${user.imobiliaria_id}&role=${user.role}`, {
        method: 'GET',
        headers: getHeaders()
      });
      if (!response.ok) throw new Error('Falha ao buscar dados do servidor');
      
      const data = await response.json();
      
      const rawClients = Array.isArray(data.clientes) ? data.clientes : [];
      const rawImoveis = Array.isArray(data.imoveis) ? data.imoveis : [];

      // Processar Clientes
      const mappedClients = rawClients.map(c => ({...c, id: c.Id || c.id}));
      setAllClients(mappedClients); 

      const validClients = mappedClients.filter(c => c.nome && String(c.nome).trim() !== '' && String(c.ativo).toLowerCase() !== 'excluido');
      
      const uniqueClientsMap = new Map();
      validClients.forEach(c => {
        const key = c.cpf ? String(c.cpf).trim() : String(c.telefone || '').trim();
        if (key && !uniqueClientsMap.has(key)) uniqueClientsMap.set(key, c);
      });
      setClients(Array.from(uniqueClientsMap.values()));

      // Processar Imoveis
      const validImoveis = rawImoveis.map(i => ({...i, id: i.Id || i.id}));
      const uniqueImoveisMap = new Map();
      validImoveis.forEach(i => {
         if (i.id && !uniqueImoveisMap.has(i.id)) {
             uniqueImoveisMap.set(i.id, i);
         }
      });
      setImoveis(Array.from(uniqueImoveisMap.values()));

    } catch (error) {
      console.error(error);
      setErrorMsg('Erro de ligação. Verifique se o n8n está ativo. (' + error.message + ')');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleBulkCobrar = () => {
     const atrasados = clients.filter(c => getPaymentInfo(c).isLate);
     if (atrasados.length === 0) return alert("Não existem inquilinos em atraso!");
     if (window.confirm(`Deseja notificar todos os ${atrasados.length} inquilinos em atraso?`)) {
         alert("Ação enviada para o n8n!");
     }
  };

  const handleTogglePaymentStatus = async (client) => {
    const info = getPaymentInfo(client);
    const acaoDesejada = info.isPaid ? 'PENDENTE' : 'PAGO';
    const msgConfirmacao = info.isPaid 
      ? `Deseja anular o pagamento de ${client.nome}? O estado voltará para Pendente.`
      : `Confirmar o pagamento manual (em dinheiro/PIX fora do sistema) para ${client.nome}?`;

    if (window.confirm(msgConfirmacao)) {
      setIsLoading(true);
      try {
        const today = new Date();
        const defaultMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        let payloadClient = { ...client };
        payloadClient.atualizado_em = `${acaoDesejada}-${defaultMonthStr}`;
        payloadClient.imobiliaria_id = user.imobiliaria_id; // Força segurança SaaS

        const payload = {
          action: 'update',
          id: client.Id || client.id,
          client: payloadClient
        };

        const response = await fetch(WEBHOOK_URL, { 
          method: 'POST', 
          headers: getHeaders(), 
          body: JSON.stringify(payload) 
        });
        
        if (!response.ok) throw new Error('Falha ao atualizar o estado na base de dados');
        await fetchClients();
      } catch (error) { 
        alert('Erro ao atualizar o estado: ' + error.message); 
      } finally { 
        setIsLoading(false); 
      }
    }
  };

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const kpis = useMemo(() => {
    let totalReceita = 0;
    let recebido = 0;
    let inadimplente = 0;
    let ativosCount = 0;

    clients.forEach(c => {
      if (String(c.ativo).toLowerCase() === 'sim') {
        ativosCount++;
        totalReceita += Number(c.valor_centavos || 0);

        const info = getPaymentInfo(c);
        if (info.isPaid) recebido += Number(c.valor_centavos || 0);
        else if (info.isLate) inadimplente += Number(c.valor_centavos || 0);
      }
    });

    return { totalReceita, recebido, inadimplente, ativosCount };
  }, [clients]);

  const chartData = useMemo(() => {
    const data = [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const isCurrentMonth = i === 0;
      data.push({ name: monthNames[d.getMonth()], Receita: isCurrentMonth ? kpis.totalReceita : 0, Recebido: isCurrentMonth ? kpis.recebido : 0 });
    }
    return data;
  }, [kpis.totalReceita, kpis.recebido]);

  const getClientStatus = (client) => {
    if (String(client.ativo).toLowerCase() !== 'sim') return { label: 'Inativo', color: 'bg-slate-100 text-slate-600' };
    const info = getPaymentInfo(client);
    if (info.isPaid) return { label: 'Pago', color: 'bg-emerald-100 text-emerald-700' };
    if (info.isLate) return { label: 'Atrasado', color: 'bg-rose-100 text-rose-700' };
    return { label: 'Pendente', color: 'bg-amber-100 text-amber-700' };
  };

  const handleSaveClient = async (clientData) => {
    setIsLoading(true);
    try {
      const isUpdating = !!editingClient;
      const defaultMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      let payloadClient = { ...clientData };
      payloadClient.imobiliaria_id = user.imobiliaria_id; // Força Segurança SaaS
      
      payloadClient.cpf = payloadClient.cpf ? payloadClient.cpf.replace(/\D/g, '') : '';

      let foneLimpo = payloadClient.telefone ? payloadClient.telefone.replace(/\D/g, '') : '';
      if (!foneLimpo.startsWith('55')) {
         foneLimpo = '55' + foneLimpo;
      }
      if (foneLimpo.length !== 12 && foneLimpo.length !== 13) {
         alert("O número de WhatsApp está incompleto ou inválido. Digite apenas o DDD e o número (ex: 95991265983). O '55' já está embutido.");
         setIsLoading(false);
         return;
      }
      payloadClient.telefone = foneLimpo;

      let fiadorFoneLimpo = payloadClient.fiador_telefone ? payloadClient.fiador_telefone.replace(/\D/g, '') : '';
      if (fiadorFoneLimpo.length > 0) {
         if (!fiadorFoneLimpo.startsWith('55')) {
            fiadorFoneLimpo = '55' + fiadorFoneLimpo;
         }
         if (fiadorFoneLimpo.length !== 12 && fiadorFoneLimpo.length !== 13) {
            alert("O número do Fiador está incompleto ou inválido. Corrija para continuar.");
            setIsLoading(false);
            return;
         }
         payloadClient.fiador_telefone = fiadorFoneLimpo;
      }

      payloadClient.atualizado_em = isUpdating ? clientData.atualizado_em : `PENDENTE-${defaultMonthStr}`;
      
      if (!isUpdating) {
         delete payloadClient.Id; 
         delete payloadClient.id; 
      }

      let actionToUse = isUpdating ? 'update' : 'create';
      let idToUse = isUpdating ? (editingClient.Id || editingClient.id) : undefined;

      if (payloadClient.cpf) {
        const existingClient = allClients.find(c => c.cpf === payloadClient.cpf && c.id !== idToUse);
        if (existingClient) {
          if (String(existingClient.ativo).toLowerCase() === 'excluido') {
             actionToUse = 'update';
             idToUse = existingClient.id;
             payloadClient.ativo = 'sim';
          } else {
             alert("Já existe um inquilino ativo cadastrado com este CPF.");
             setIsLoading(false);
             return;
          }
        }
      }

      const payload = {
        action: actionToUse,
        id: idToUse,
        client: payloadClient
      };

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Falha ao guardar no n8n');
      
      await fetchClients();
      setModalState(s => ({...s, client: false}));
      setEditingClient(null);
    } catch (error) {
      alert('Erro ao guardar inquilino: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem a certeza que deseja excluir este inquilino do sistema?')) {
      setIsLoading(true);
      try {
        const payload = { action: 'delete', id: id };
        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Falha ao eliminar no n8n');
        await fetchClients();
      } catch (error) {
        alert('Erro ao excluir inquilino: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveImovel = async (imovelData) => {
    setIsLoading(true);
    try {
      const isUpdating = !!editingImovel;
      // Adiciona Segurança SaaS
      const payloadImovel = { ...imovelData, imobiliaria_id: user.imobiliaria_id };
      
      const payload = {
        action: isUpdating ? 'update_imovel' : 'create_imovel',
        id: isUpdating ? (editingImovel.Id || editingImovel.id) : undefined,
        imovel: payloadImovel
      };

      const response = await fetch(WEBHOOK_URL, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('Falha ao salvar imóvel no n8n');
      await fetchClients();
      setModalState(s => ({...s, imovel: false}));
      setEditingImovel(null);
    } catch (error) { alert('Erro: ' + error.message); } finally { setIsLoading(false); }
  };

  const handleDeleteImovel = async (id) => {
    if(window.confirm('Excluir este imóvel do portfólio?')) {
      setIsLoading(true);
      try {
        const payload = { action: 'delete_imovel', id: id };
        const response = await fetch(WEBHOOK_URL, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
        if (!response.ok) throw new Error('Falha ao deletar imóvel no n8n');
        await fetchClients();
      } catch (error) { alert('Erro ao excluir: ' + error.message); } finally { setIsLoading(false); }
    }
  };

  const openEditClientModal = (client) => {
    setEditingClient(client);
    setModalState(s => ({...s, client: true}));
  };

  const openNewClientModal = () => {
    setEditingClient(null);
    setModalState(s => ({...s, client: true}));
  };

  const openEditImovelModal = (imovel) => {
    setEditingImovel(imovel);
    setModalState(s => ({...s, imovel: true}));
  };

  const openNewImovelModal = () => {
    setEditingImovel(null);
    setModalState(s => ({...s, imovel: true}));
  };

  const filteredClients = clients.filter(c => {
    const nome = String(c.nome || '').toLowerCase();
    const desc = String(c.descricao || '').toLowerCase();
    const cpf = String(c.cpf || '');
    const sTerm = searchTerm.toLowerCase();
    return nome.includes(sTerm) || desc.includes(sTerm) || cpf.includes(sTerm);
  });

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-10 hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <div className="flex items-center gap-2 text-indigo-600">
           <img src={logo} alt="Cedro"  className='mx-auto w-14 h-14 br-5 drop-shadow-md rounded-xl'/>
            <h2 className="text-4xl font-black tracking-[-0.05em] text-slate-800">
  <span className="text-slate-900">Ce</span>
  <span className="bg-gradient-to-r from-[#14532D] to-[#15803D] bg-clip-text text-transparent">
    dro
  </span>
</h2>
          </div>
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <TrendingUp size={18} /> Resumo
          </button>
          <button 
            onClick={() => setActiveTab('clientes')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'clientes' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Users size={18} /> Inquilinos
          </button>
          <button 
            onClick={() => setActiveTab('imoveis')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'imoveis' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Building size={24}/> Meus Imóveis
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
             <h1 className="text-xl lg:text-2xl font-semibold text-slate-800">
              {activeTab === 'dashboard' ? 'Visão Geral' : activeTab === 'clientes' ? 'Gestão de Inquilinos' : 'Portfólio de Imóveis'}
            </h1>
            <button 
              onClick={fetchClients} 
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition-colors"
              title="Sincronizar Base de Dados"
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin text-indigo-600" : ""} />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-sm font-bold text-slate-700">{user?.nome || 'Utilizador'}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {user?.role === 'admin' ? 'Admin' : 'Agência'}
                </span>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm uppercase">
                {user?.nome ? user.nome.charAt(0) : 'U'}
              </div>
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors flex items-center gap-2" title="Terminar Sessão">
              <LogOut size={18} />
              <span className="text-sm font-medium hidden sm:block">Sair</span>
            </button>
          </div>
        </header>

        {errorMsg && (
           <div className="bg-red-50 border-l-4 border-red-500 p-4 m-6 mb-0 rounded-r shadow-sm flex items-start gap-3">
             <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
             <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
           </div>
        )}

        <div className="flex-1 overflow-auto p-6 lg:p-8">
          {isLoading && clients.length === 0 && !errorMsg && (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center text-indigo-600 gap-3">
                <Loader2 size={32} className="animate-spin" />
                <span className="font-medium">A carregar dados...</span>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (!isLoading || clients.length > 0) && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">Receita Esperada</p>
                      <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(kpis.totalReceita)}</h3>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><TrendingUp size={20}/></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4">Mês atual</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">Valor Recebido</p>
                      <h3 className="text-2xl font-bold text-green-600">{formatCurrency(kpis.recebido)}</h3>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg text-green-600"><CheckCircle size={20}/></div>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all duration-1000" style={{width: `${(kpis.recebido/kpis.totalReceita)*100 || 0}%`}}></div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">Inadimplência</p>
                      <h3 className="text-2xl font-bold text-red-600">{formatCurrency(kpis.inadimplente)}</h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg text-red-600"><AlertCircle size={20}/></div>
                  </div>
                  <p className="text-xs text-red-500 mt-4 font-medium">Requer atenção imediata</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">Inquilinos Ativos</p>
                      <h3 className="text-2xl font-bold text-slate-800">{kpis.ativosCount}</h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users size={20}/></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4">Contratos vigentes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
                   <h2 className="text-lg font-bold text-slate-800 mb-6">Desempenho (Últimos 6 meses)</h2>
                   <div className="h-72 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$ ${value/1000}k`} />
                          <RechartsTooltip cursor={{fill: '#f8fafc'}} formatter={(value) => formatCurrency(value)} />
                          <Bar dataKey="Receita" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          <Bar dataKey="Recebido" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <AlertCircle className="text-amber-500" size={16} /> Atenção Necessária
                    </h2>
                  </div>
                  <div className="p-0 overflow-y-auto flex-1 max-h-80">
                    {clients.filter(c => String(c.ativo).toLowerCase() === 'sim' && c.atualizado_em !== `PAGO-${currentMonthStr}`).length === 0 ? (
                       <div className="p-10 flex flex-col items-center justify-center text-slate-400">
                         <CheckCircle size={40} className="mb-3 text-emerald-300" />
                         <p className="font-semibold text-slate-600">Tudo em dia!</p>
                       </div>
                    ) : (
                      <ul className="divide-y divide-slate-50">
                        {clients
                          .filter(c => String(c.ativo).toLowerCase() === 'sim' && c.atualizado_em !== `PAGO-${currentMonthStr}`)
                          .sort((a, b) => Number(a.dia_vencimento) - Number(b.dia_vencimento))
                          .slice(0, 5)
                          .map(client => {
                            const info = getPaymentInfo(client);
                            return (
                            <li key={client.id} className="p-5 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                              <div>
                                <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                  {info.isLate ? <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span> : <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>}
                                  {client.nome}
                                </p>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded w-max mt-1 inline-block ${info.isLate ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {info.isLate ? `Atraso de ${Math.abs(info.diffDays)} dias` : info.diffDays === 0 ? 'Vence HOJE' : `Vence em ${info.diffDays} dias`}
                                </span>
                              </div>
                              <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleTogglePaymentStatus(client)}
                                  className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                  title="Marcar como Pago Manualmente"
                                >
                                  <Banknote size={16} />
                                </button>
                                <a 
                                  href={generateBillingLink(client)} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" 
                                  title="Cobrar via WhatsApp"
                                >
                                  <MessageCircle size={16} />
                                </a>
                              </div>
                            </li>
                          )})}
                      </ul>
                    )}
                  </div>
                  {clients.filter(c => String(c.ativo).toLowerCase() === 'sim' && c.atualizado_em !== `PAGO-${currentMonthStr}`).length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50">
                      <button onClick={handleBulkCobrar} className="w-full py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-900 shadow-md transition-colors">
                        Notificar Inadimplentes
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clientes' && (!isLoading || clients.length > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[500px]">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 rounded-t-xl">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome ou imóvel..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                  />
                </div>
                <button 
                  onClick={openNewClientModal}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
                >
                  <Plus size={18} /> Cadastrar Inquilino
                </button>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-white text-xs uppercase text-slate-400 border-b border-slate-200">
                      <th className="px-6 py-4 font-semibold tracking-wider">Inquilino</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Contato</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Imóvel</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Aluguel</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Venc. Contrato</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Status Mensal</th>
                      <th className="px-6 py-4 font-semibold tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredClients.map(client => {
                      const status = getClientStatus(client);
                      const info = getPaymentInfo(client);
                      const isContractExpiring = client.fim_contrato && new Date(client.fim_contrato) < new Date(today.getTime() + 30*24*60*60*1000);

                      return (
                        <tr key={client.id} className="hover:bg-indigo-50/30 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-800">{client.nome}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Venc: Dia {client.dia_vencimento}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-slate-700 font-medium">{formatPhone(client.telefone)}</p>
                            <p className="text-xs text-slate-500">{client.cpf ? `CPF: ${formatCPF(client.cpf)}` : client.email}</p>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                             <div className="max-w-[200px] truncate" title={client.descricao}>{client.descricao}</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{formatCurrency(client.valor_centavos)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 ${isContractExpiring ? 'text-orange-600 font-semibold' : 'text-slate-600'}`}>
                              {isContractExpiring && <AlertCircle size={14}/>}
                              {client.fim_contrato ? new Date(client.fim_contrato + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${status.color} ${status.color.replace('bg-', 'border-').replace('-100', '-200')}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleTogglePaymentStatus(client)}
                                className={`p-2 rounded-lg transition-colors ${info.isPaid ? 'text-amber-500 hover:bg-amber-100' : 'text-emerald-600 hover:bg-emerald-100'}`}
                                title={info.isPaid ? "Anular Pagamento Manual" : "Marcar como Pago Manualmente"}
                              >
                                {info.isPaid ? <Undo2 size={18} /> : <Banknote size={18} />}
                              </button>
                              <a 
                                href={`https://wa.me/${String(client.telefone || '').replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                title="Abrir WhatsApp"
                              >
                                <MessageCircle size={18} />
                              </a>
                              <button 
                                onClick={() => openEditClientModal(client)}
                                className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(client.id || client.Id)}
                                className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredClients.length === 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-16 text-center">
                           <div className="flex flex-col items-center text-slate-400">
                             <Users size={48} className="mb-4 text-slate-200" />
                             <p className="text-lg font-medium text-slate-600">Nenhum inquilino encontrado</p>
                             <p className="text-sm">Tente ajustar a sua pesquisa ou adicione um novo registo.</p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'imoveis' && (
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden max-w-7xl mx-auto">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Portfólio de Imóveis</h2>
                  </div>
                  <button onClick={openNewImovelModal} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
                    <Plus size={18} /> Adicionar Imóvel
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {imoveis.map(imovel => {
                         const searchStr = String(imovel.endereco || imovel.nome).trim().toLowerCase();
                         const ocupante = clients.find(c => c.ativo === 'sim' && String(c.descricao).trim().toLowerCase() === searchStr);
                         
                         return (
                           <div key={imovel.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-all hover:border-indigo-200">
                              <div className="flex justify-between items-start mb-4">
                                <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${ocupante ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                                  {ocupante ? 'Ocupado' : 'Disponível'}
                                </div>
                                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => openEditImovelModal(imovel)} className="p-1.5 rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Edit2 size={14} /></button>
                                   <button onClick={() => handleDeleteImovel(imovel.id)} className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <h3 className="font-semibold text-slate-800 text-base mb-1 truncate" title={imovel.nome}>{imovel.nome}</h3>
                              <p className="text-sm text-slate-500 mb-5 h-10 line-clamp-2" title={imovel.endereco}>
                                <Home size={14} className="inline mr-1 text-slate-400 -mt-0.5"/> 
                                {imovel.endereco || 'Sem endereço'}
                              </p>
                              
                              {ocupante ? (
                                 <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                    <p className="text-[10px] text-emerald-600/80 font-bold mb-0.5 uppercase tracking-wider">Inquilino Atual:</p>
                                    <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5 truncate">
                                      <CheckCircle size={14} className="text-emerald-500 shrink-0" /> {ocupante.nome}
                                    </p>
                                 </div>
                              ) : (
                                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 border-dashed">
                                    <p className="text-[10px] text-slate-500 font-bold mb-0.5 uppercase tracking-wider">Valor Sugerido:</p>
                                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                      <TrendingUp size={14} className="text-slate-400 shrink-0" /> {formatCurrency(imovel.valor_base)}
                                    </p>
                                 </div>
                              )}
                           </div>
                         );
                      })}
                      {imoveis.length === 0 && (
                        <div className="col-span-full text-center py-12">
                          <Building className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                          <h3 className="text-sm font-medium text-slate-900">Sem Imóveis</h3>
                          <p className="mt-1 text-sm text-slate-500">Comece a adicionar as propriedades do seu portfólio.</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          )}

        </div>
      </main>

      {modalState.client && (
        <ClientModal 
          client={editingClient} 
          imoveis={imoveis} 
          allClients={allClients} 
          onClose={() => setModalState(s => ({...s, client: false}))} 
          onSave={handleSaveClient} 
          isSaving={isLoading}
        />
      )}
      {modalState.imovel && (
        <ImovelModal 
          imovel={editingImovel} 
          onClose={() => setModalState(s => ({...s, imovel: false}))} 
          onSave={handleSaveImovel} 
        />
      )}
    </div>
  );
}

function ClientModal({ client, imoveis, allClients, onClose, onSave, isSaving }) {
  const [activeTab, setActiveTab] = useState('pessoal');
  
  const [formData, setFormData] = useState(() => {
    const state = client ? { ...client } : {
      nome: '', cpf: '', telefone: '55', email: '', descricao: '', valor_centavos: '', dia_vencimento: '', ativo: 'sim', fim_contrato: '', data_inicio: '', caucao: '', fiador_nome: '', fiador_telefone: ''
    };
    if (state.cpf) state.cpf = formatCPF(state.cpf);
    if (!state.telefone || String(state.telefone).replace(/\D/g, '').length < 2) {
      state.telefone = '55';
    }
    return state;
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length < 2) val = '55'; 
    if (!val.startsWith('55')) {
        val = '55' + val.replace(/^55/, ''); 
    }
    if (val.length > 13) val = val.slice(0, 13);
    setFormData(prev => ({ ...prev, telefone: val }));
  };

  const handleImovelChange = (e) => {
    const selectedAddress = String(e.target.value);
    const foundImovel = imoveis.find(i => String(i.endereco || i.nome).trim().toLowerCase() === selectedAddress.trim().toLowerCase());
    setFormData(prev => ({ 
      ...prev, 
      descricao: selectedAddress, 
      valor_centavos: foundImovel ? foundImovel.valor_base : prev.valor_centavos 
    }));
  };

  const handleValorChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, valor_centavos: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const historyData = useMemo(() => {
    if (!client) return [];
    const history = [];
    const today = new Date();
    const start = client.data_inicio ? new Date(client.data_inicio) : new Date(today.getFullYear(), today.getMonth() - 5, 1);
    let dia = parseInt(client.dia_vencimento);
    if (isNaN(dia) || dia < 1 || dia > 31) dia = 1;

    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, dia);
      if (d < start && i !== 0) continue; 
      
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (i === 0) {
         const info = getPaymentInfo(client);
         let statusAtualDesc = 'Pendente';
         if (info.isPaid) statusAtualDesc = 'Pago';
         if (info.isLate) statusAtualDesc = 'Atrasado';

         history.push({
           id: monthStr, mes: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), vencimento: d.toLocaleDateString('pt-BR'),
           pagamento: info.isPaid ? 'Registrado' : '-', status: statusAtualDesc, valor: client.valor_centavos
         });
      } else {
         const diaPagto = dia - Math.floor(Math.random() * 3);
         const dataPagto = new Date(d.getFullYear(), d.getMonth(), diaPagto > 0 ? diaPagto : 1).toLocaleDateString('pt-BR');
         history.push({
           id: monthStr, mes: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), vencimento: d.toLocaleDateString('pt-BR'),
           pagamento: dataPagto, status: 'Pago', valor: client.valor_centavos
         });
      }
    }
    return history;
  }, [client]);

  const currentDesc = String(formData.descricao || '');
  const matchedImovelForSelect = imoveis.find(i => String(i.endereco || i.nome).trim().toLowerCase() === currentDesc.trim().toLowerCase());
  const selectValue = matchedImovelForSelect ? (matchedImovelForSelect.endereco || matchedImovelForSelect.nome) : currentDesc;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-slate-200">
        
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
             {client ? <Edit2 className="text-indigo-500" size={20} /> : <Plus className="text-indigo-500" size={20} />}
            {client ? 'Editar Inquilino' : 'Cadastrar Novo Inquilino'}
          </h2>
          <button onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-8 bg-slate-50/50 overflow-x-auto whitespace-nowrap">
           <button type="button" onClick={() => setActiveTab('pessoal')} className={`py-4 px-2 text-sm font-bold border-b-2 mr-6 transition-colors ${activeTab === 'pessoal' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Dados Pessoais</button>
           <button type="button" onClick={() => setActiveTab('contrato')} className={`py-4 px-2 text-sm font-bold border-b-2 mr-6 transition-colors ${activeTab === 'contrato' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Contrato & Finanças</button>
           <button type="button" onClick={() => setActiveTab('fiador')} className={`py-4 px-2 text-sm font-bold border-b-2 mr-6 transition-colors ${activeTab === 'fiador' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Garantias / Fiador</button>
           {client && <button type="button" onClick={() => setActiveTab('historico')} className={`py-4 px-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'historico' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Histórico</button>}
        </div>

        <form id="client-form" onSubmit={handleSubmit} className="flex-1 overflow-auto p-6 bg-slate-50/50">
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 ${activeTab !== 'pessoal' && 'hidden'}`}>
            
            <div className="col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome Completo <span className="text-red-500">*</span></label>
              <input required name="nome" value={formData.nome} onChange={handleChange} type="text" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" placeholder="Ex: João Silva"/>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">CPF <span className="text-red-500">*</span></label>
              <input required name="cpf" value={formatCPF(formData.cpf)} onChange={(e) => setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))} maxLength="14" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500" placeholder="000.000.000-00"/>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp (Cód. + DDD + Núm.) <span className="text-red-500">*</span></label>
              <input required name="telefone" value={formData.telefone} onChange={handlePhoneChange} type="text" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" placeholder="5595991265983"/>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
              <input name="email" value={formData.email} onChange={handleChange} type="email" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" placeholder="joao@email.com"/>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status do Contrato</label>
              <select name="ativo" value={formData.ativo} onChange={handleChange} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="sim">🔵 Ativo</option>
                <option value="nao">⚪ Inativo</option>
              </select>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 ${activeTab !== 'contrato' && 'hidden'}`}>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Imóvel Associado <span className="text-red-500">*</span></label>
              <select required name="descricao" value={selectValue} onChange={handleImovelChange} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow">
                <option value="">Selecione um imóvel disponível...</option>
                {imoveis.map(i => {
                   const searchStr = String(i.endereco || i.nome).trim().toLowerCase();
                   const isOccupiedByOther = allClients.some(c => {
                      const isActive = String(c.ativo).toLowerCase() === 'sim';
                      const matchesAddress = String(c.descricao).trim().toLowerCase() === searchStr;
                      const isNotCurrent = c.id !== (client ? (client.Id || client.id) : null);
                      return isActive && matchesAddress && isNotCurrent;
                   });
                   return (
                     <option key={i.id} value={i.endereco || i.nome} disabled={isOccupiedByOther}>
                       {i.nome} {i.endereco ? `(${i.endereco})` : ''} {isOccupiedByOther ? ' ⛔ (Ocupado)' : ''}
                     </option>
                   );
                })}
                {currentDesc && !matchedImovelForSelect && <option value={currentDesc}>{currentDesc} (Personalizado)</option>}
              </select>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Imóveis ocupados não podem ser selecionados para um novo inquilino ativo.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Valor do Aluguel <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                <input required value={formatInputCurrency(formData.valor_centavos)} onChange={handleValorChange} type="text" className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" placeholder="1.500,00"/>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dia do Vencimento <span className="text-red-500">*</span></label>
              <input required name="dia_vencimento" value={formData.dia_vencimento} onChange={handleChange} type="number" min="1" max="31" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" placeholder="Ex: 10"/>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Data Início</label>
              <input name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow text-slate-700" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fim do Contrato</label>
              <input name="fim_contrato" value={formData.fim_contrato} onChange={handleChange} type="date" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow text-slate-700" />
            </div>

          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 ${activeTab !== 'fiador' && 'hidden'}`}>
             <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Valor Caução</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
                <input name="caucao" value={formatInputCurrency(formData.caucao)} onChange={handleValorChange} type="text" className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" placeholder="3.000,00"/>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do Fiador</label>
              <input name="fiador_nome" value={formData.fiador_nome || ''} onChange={handleChange} type="text" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contato Fiador</label>
              <input name="fiador_telefone" value={formData.fiador_telefone || ''} onChange={handleChange} type="text" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow" placeholder="Ex: 5595991265983" />
            </div>
          </div>

          <div className={`flex flex-col h-full ${activeTab !== 'historico' && 'hidden'}`}>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
               <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                     <tr><th className="px-5 py-4">Mês Referência</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Valor</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                     {historyData.map((h, i) => (
                       <tr key={h.id} className={i === 0 ? "bg-indigo-50/30" : "hover:bg-slate-50"}>
                          <td className="px-5 py-4 font-semibold text-slate-800 capitalize">{h.mes}</td>
                          <td className="px-5 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${h.status==='Pago'?'bg-emerald-100 text-emerald-700':h.status==='Atrasado'?'bg-rose-100 text-rose-700':'bg-amber-100 text-amber-700'}`}>{h.status}</span></td>
                          <td className="px-5 py-4 font-bold text-slate-800">{formatCurrency(h.valor)}</td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          </div>
        </form>

        <div className="px-6 py-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-slate-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="client-form" disabled={isSaving} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {isSaving ? 'A guardar...' : 'Guardar Inquilino'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImovelModal({ imovel, onClose, onSave }) {
  const [formData, setFormData] = useState(() => imovel ? { ...imovel } : { nome: '', endereco: '', valor_base: '' });
  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleValorChange = (e) => { let val = e.target.value.replace(/\D/g, ''); setFormData(prev => ({ ...prev, [e.target.name]: val })); };
  const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-white">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {imovel ? <Edit2 className="text-indigo-500" size={20} /> : <Plus className="text-indigo-500" size={20} />}
            {imovel ? 'Editar Imóvel' : 'Adicionar Imóvel'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg"><X size={20} /></button>
        </div>
        <form id="imovel-form" onSubmit={handleSubmit} className="p-6 bg-slate-50/50 space-y-5">
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Referência <span className="text-red-500">*</span></label><input required name="nome" value={formData.nome} onChange={handleChange} className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Endereço Completo <span className="text-red-500">*</span></label><textarea required name="endereco" value={formData.endereco} onChange={handleChange} rows="3" className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Valor Base Sugerido</label><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span><input name="valor_base" value={formatInputCurrency(formData.valor_base)} onChange={handleValorChange} className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div></div>
        </form>
        <div className="px-6 py-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none">Cancelar</button>
          <button type="submit" form="imovel-form" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none">Salvar Imóvel</button>
        </div>
      </div>
    </div>
  );
}
