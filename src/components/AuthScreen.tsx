import React, { useState } from 'react';
import {
  Shield,
  User,
  KeyRound,
  Lock,
  ArrowRight,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Phone,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  loginUser,
  registerMemberAccount,
  registerAdminAccount,
  getAdminPasscode,
  getAuthAccounts,
  MAX_ADMIN_COUNT,
  type UserAccount,
} from '../utils/authLogic';
import { AMBALAN_SHIELD_LOGO_BASE64 } from '../assets/logoAssets';

interface AuthScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
}

type AuthMode = 'login_member' | 'login_admin' | 'register_member' | 'register_admin';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login_member');

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register Fields
  const [regName, setRegName] = useState('');
  const [regKelas, setRegKelas] = useState('XI IPA 1');
  const [regJabatan, setRegJabatan] = useState('Penegak Bantara');
  const [regSangga, setRegSangga] = useState('Sangga Perintis');
  const [regPhone, setRegPhone] = useState('');
  const [regAdminRole, setRegAdminRole] = useState('Staf Dewan Inventaris');
  const [adminSecretCode, setAdminSecretCode] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const accounts = getAuthAccounts();
  const currentAdmins = accounts.filter((a) => a.role === 'admin' && a.status === 'active');
  const adminSlotsRemaining = MAX_ADMIN_COUNT - currentAdmins.length;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = loginUser(username, password);
    if (!res.success || !res.user) {
      setErrorMessage(res.error || 'Login gagal. Periksa kembali username dan kata sandi Anda!');
      return;
    }

    // Role check if logging in via specific tab
    if (mode === 'login_admin' && res.user.role !== 'admin') {
      setErrorMessage('Akun ini terdaftar sebagai Peserta, bukan Dewan Inventaris (Admin)!');
      return;
    }

    setSuccessMessage(`Selamat datang, ${res.user.name}!`);
    setTimeout(() => {
      onLoginSuccess(res.user!);
    }, 400);
  };

  const handleRegisterMember = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regPhone.trim()) {
      setErrorMessage('Harap masukkan nomor WhatsApp / HP aktif!');
      return;
    }

    const res = registerMemberAccount({
      name: regName,
      kelas: regKelas,
      jabatan: regJabatan,
      sangga: regSangga,
      phone: regPhone,
      username,
      password,
    });

    if (!res.success || !res.user) {
      setErrorMessage(res.error || 'Pendaftaran gagal!');
      return;
    }

    setSuccessMessage(`Akun Peserta berhasil dibuat untuk ${res.user.name}!`);
    setTimeout(() => {
      onLoginSuccess(res.user!);
    }, 600);
  };

  const handleRegisterAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const res = registerAdminAccount(
      {
        name: regName,
        username,
        password,
        adminRole: regAdminRole,
      },
      adminSecretCode
    );

    if (!res.success || !res.user) {
      setErrorMessage(res.error || 'Pendaftaran Admin gagal!');
      return;
    }

    setSuccessMessage(`Selamat! Anda terdaftar sebagai Dewan Inventaris (${res.user.name})`);
    setTimeout(() => {
      onLoginSuccess(res.user!);
    }, 600);
  };

  const handleFillDemo = (type: 'admin' | 'member') => {
    setErrorMessage(null);
    if (type === 'admin') {
      setMode('login_admin');
      setUsername('admin.raisyah');
      setPassword('admin');
    } else {
      setMode('login_member');
      setUsername('neo.willyan.pratama');
      setPassword('pramuka123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2A1810] via-[#3B2314] to-[#1C100A] flex flex-col items-center justify-center p-4 text-[#FBF8F3]">
      {/* Container */}
      <div className="w-full max-w-md bg-[#FBF8F3] text-[#2A1810] rounded-3xl shadow-2xl border border-[#D9C3A9] overflow-hidden">
        {/* Header Branding */}
        <div className="bg-[#3B2314] p-6 text-center text-[#FBF8F3] relative border-b-2 border-[#C89D54]">
          <div className="w-20 h-24 mx-auto mb-3 flex items-center justify-center">
            <img
              src={AMBALAN_SHIELD_LOGO_BASE64}
              alt="Logo Ambalan MAN 11 Jakarta"
              className="max-h-full max-w-full object-contain drop-shadow-md"
            />
          </div>
          <h1 className="text-xl font-extrabold tracking-wide uppercase">SIPRAMA</h1>
          <p className="text-[12px] text-[#D9C3A9] font-medium mt-0.5">
            Sistem Inventaris Pramuka MAN 11 Jakarta
          </p>
          <p className="text-[10px] text-[#A88B74] font-semibold mt-1">
            Gugusdepan 06.171 – 06.172 · Ambalan Khobinwal - Umkul
          </p>
        </div>

        {/* Navigation Selector */}
        <div className="p-4 bg-[#F4EDE2] border-b border-[#D9C3A9]">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#E8DCB8]/60 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login_member');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login_member' || mode === 'register_member'
                  ? 'bg-[#3B2314] text-white shadow-xs'
                  : 'text-[#6E5039] hover:text-[#2A1810]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Peserta / Anggota
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login_admin');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login_admin' || mode === 'register_admin'
                  ? 'bg-[#8B2500] text-white shadow-xs'
                  : 'text-[#6E5039] hover:text-[#2A1810]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Dewan Inventaris (Admin)
            </button>
          </div>

          {/* Submode toggles */}
          <div className="flex items-center justify-center gap-4 mt-2 text-xs">
            {mode.startsWith('login') ? (
              <button
                type="button"
                onClick={() =>
                  setMode(mode === 'login_admin' ? 'register_admin' : 'register_member')
                }
                className="text-[#8B2500] font-bold hover:underline inline-flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Belum punya akun? Buat akun di sini
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setMode(mode === 'register_admin' ? 'login_admin' : 'login_member')
                }
                className="text-[#3B2314] font-bold hover:underline inline-flex items-center gap-1"
              >
                Sudah punya akun? Masuk langsung
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ================= FORM 1: LOGIN (MEMBER OR ADMIN) ================= */}
          {(mode === 'login_member' || mode === 'login_admin') && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#3B2314]">Username Akun</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B6B4A]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      mode === 'login_admin'
                        ? 'Contoh: admin.raisyah / admin.fatihah'
                        : 'Contoh: neo.willyan.pratama'
                    }
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold text-[#2A1810] focus:ring-2 focus:ring-[#8B2500] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#3B2314]">Kata Sandi (Password)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8B6B4A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold text-[#2A1810] focus:ring-2 focus:ring-[#8B2500] focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-3 rounded-xl text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
                  mode === 'login_admin'
                    ? 'bg-[#8B2500] hover:bg-[#6e1e00]'
                    : 'bg-[#3B2314] hover:bg-[#25150a]'
                }`}
              >
                <span>
                  Masuk sebagai {mode === 'login_admin' ? 'Dewan Inventaris (Admin)' : 'Peserta Pramuka'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Demo Quick Logins */}
              <div className="pt-2 border-t border-[#D9C3A9]/70 space-y-1.5">
                <p className="text-[11px] font-bold text-[#6E5039] text-center">
                  Bantuan Masuk Cepat (Akun Uji Coba):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFillDemo('admin')}
                    className="py-1.5 px-2.5 bg-[#EFE6D8] border border-[#D9C3A9] rounded-lg text-[11px] font-bold text-[#8B2500] hover:bg-[#E2D2BC] transition-colors text-center"
                  >
                    👑 Masuk Admin (Raisyah)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillDemo('member')}
                    className="py-1.5 px-2.5 bg-[#EFE6D8] border border-[#D9C3A9] rounded-lg text-[11px] font-bold text-[#3B2314] hover:bg-[#E2D2BC] transition-colors text-center"
                  >
                    🏕️ Masuk Peserta (Neo)
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================= FORM 2: REGISTER MEMBER (OPEN FOR ALL) ================= */}
          {mode === 'register_member' && (
            <form onSubmit={handleRegisterMember} className="space-y-3">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Pendaftaran akun peserta terbuka untuk seluruh anggota pramuka MAN 11.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Misal: Ahmad Zaky Pratama"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">Kelas *</label>
                  <input
                    type="text"
                    required
                    value={regKelas}
                    onChange={(e) => setRegKelas(e.target.value)}
                    placeholder="XI IPA 1 / X-4"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">Jabatan *</label>
                  <select
                    value={regJabatan}
                    onChange={(e) => setRegJabatan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                  >
                    <option value="Penegak Bantara">Penegak Bantara</option>
                    <option value="Penegak Laksana">Penegak Laksana</option>
                    <option value="Pradana">Pradana</option>
                    <option value="Kerani">Kerani</option>
                    <option value="Juru Uang">Juru Uang</option>
                    <option value="Anggota Penegak">Anggota Penegak</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">Sangga</label>
                  <input
                    type="text"
                    value={regSangga}
                    onChange={(e) => setRegSangga(e.target.value)}
                    placeholder="Sangga Perintis"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">No. WhatsApp / HP *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D9C3A9]">
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">Username Login *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Buat username unik"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">Kata Sandi *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#3B2314] hover:bg-[#25150a] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Daftar Akun Peserta & Masuk Langsung</span>
              </button>
            </form>
          )}

          {/* ================= FORM 3: REGISTER ADMIN (REQUIRES ADMIN PASSCODE & <=6) ================= */}
          {mode === 'register_admin' && (
            <form onSubmit={handleRegisterAdmin} className="space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Shield className="w-4 h-4 text-[#8B2500]" />
                  <span>Otorisasi Khusus Dewan Inventaris (Maksimal 6 Admin SK)</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Hanya dewan yang memiliki <strong>Kode Rahasia SK</strong> dari Admin Utama yang
                  dapat mendaftar sebagai Admin.
                </p>
                <div className="text-[11px] font-bold text-[#8B2500] pt-0.5">
                  Kuota Admin Terisi: {currentAdmins.length} / {MAX_ADMIN_COUNT} (Sisa slot:{' '}
                  {Math.max(0, adminSlotsRemaining)})
                </div>
              </div>

              {/* Master Admin Passcode */}
              <div>
                <label className="block text-xs font-bold text-[#8B2500] mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  Kode Rahasia Otorisasi SK Admin Utama *
                </label>
                <input
                  type="text"
                  required
                  value={adminSecretCode}
                  onChange={(e) => setAdminSecretCode(e.target.value)}
                  placeholder="Masukkan kode rahasia SK (Contoh: SK-INV-MAN11)"
                  className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#8B2500] text-xs font-mono font-bold text-[#8B2500] focus:ring-2 focus:ring-[#8B2500] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">Nama Lengkap Pengurus *</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nama lengkap sesuai SK Ambalan"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3B2314] mb-1">
                  Jabatan Dewan Inventaris *
                </label>
                <input
                  type="text"
                  required
                  value={regAdminRole}
                  onChange={(e) => setRegAdminRole(e.target.value)}
                  placeholder="Misal: Staf Inventaris & Logistik Kemah"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D9C3A9]">
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">Username Admin *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: admin.nama"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#3B2314] mb-1">Kata Sandi *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Kata sandi admin"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9C3A9] text-xs font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={adminSlotsRemaining <= 0}
                className={`w-full py-3 rounded-xl text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-2 ${
                  adminSlotsRemaining <= 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-[#8B2500] hover:bg-[#6e1e00]'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>
                  {adminSlotsRemaining <= 0
                    ? 'Kuota Admin Penuh (6/6)'
                    : 'Verifikasi Kode SK & Daftarkan Admin'}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#EFE6D8] border-t border-[#D9C3A9] text-center text-[10px] text-[#6E5039]">
          SIPRAMA Mobile v1.2 · Ambalan Pramuka MAN 11 Jakarta Selatan
        </div>
      </div>
    </div>
  );
};
