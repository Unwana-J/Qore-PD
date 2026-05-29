import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight,
  AlertTriangle,
  Fingerprint,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(window.location.search.includes('reset=true'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // States for invite verification
  const [activationStep, setActivationStep] = useState<'email' | 'password'>('email');
  const [assignedRole, setAssignedRole] = useState<string | null>(null);

  const handleTabChange = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setIsReset(false);
    setError(null);
    setSuccess(null);
    setActivationStep('email');
    setAssignedRole(null);
  };

  const handleVerifyInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('check_pending_invite', { email_to_check: email });
      if (rpcError) throw rpcError;

      if (data && data.exists) {
        setAssignedRole(data.role);
        if (data.name) {
          setName(data.name);
        }
        setActivationStep('password');
        setSuccess(`Invitation verified! Welcome, ${data.name || 'User'}.`);
      } else {
        throw new Error('This email has not been invited or the invitation has expired. Please contact your manager.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && !isReset && activationStep === 'email') {
      await handleVerifyInvite(e);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isReset) {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setSuccess('Password updated successfully! Redirecting...');
        setTimeout(() => {
          window.history.replaceState({}, '', window.location.pathname);
          setIsReset(false);
          setIsLogin(true);
        }, 2000);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { display_name: name }
          }
        });
        if (error) throw error;
        setSuccess('Check your email for the confirmation link!');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      if (error) throw error;
      setSuccess('Password reset link sent! Check your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-teal-50 rounded-bl-[100%] transition-all -z-10 opacity-30" />
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-slate-100 rounded-tr-[100%] transition-all -z-10 opacity-30" />
      
      <div className="w-full max-w-md">
        <div className="text-center mb-6 space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="h-16 flex items-center justify-center mx-auto"
          >
            <img src="/logo.png" alt="Logo" className="h-full w-auto object-contain" />
          </motion.div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">SD Project Information System</h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Strategic Project Portfolio Management</p>
          </div>
        </div>

        <motion.div 
          layout
          className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl shadow-slate-200/50"
        >
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8">
            <button 
              type="button"
              onClick={() => handleTabChange(true)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                (isLogin && !isReset) ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Log In
            </button>
            <button 
              type="button"
              onClick={() => handleTabChange(false)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                (!isLogin && !isReset) ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Activate Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl font-black text-slate-900 text-center mb-2">
              {isReset ? 'Set New Password' : isLogin ? 'Welcome Back' : 'Activate Account'}
            </h2>

            <AnimatePresence mode="wait">
              {isReset ? (
                <motion.div 
                  key="reset-fields" 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        required
                        className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        required
                        className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : isLogin ? (
                <motion.div 
                  key="login-fields" 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="email" 
                        required
                        className="w-full pl-11 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                        placeholder="name@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pl-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                      <button 
                        type="button" 
                        onClick={handleForgotPassword}
                        className="text-[10px] font-black text-teal-600 hover:text-teal-700 uppercase tracking-widest"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        required
                        className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="signup-fields" 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {activationStep === 'email' ? (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 text-center leading-relaxed">
                        Access to Qore is invite-only. Enter your pre-authorized work email to verify your access.
                      </p>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            type="email" 
                            required
                            className="w-full pl-11 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                            placeholder="name@company.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl flex items-center gap-3 text-teal-800 text-left">
                        <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                          <p className="text-xs font-black leading-snug">Invitation Verified!</p>
                          <p className="text-[10px] text-teal-600 mt-0.5 font-bold uppercase">Pre-assigned Role: {assignedRole}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                        <div className="relative">
                          <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            type="text" 
                            required
                            className="w-full pl-11 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                            placeholder="Sarah Jenkins"
                            value={name}
                            onChange={e => setName(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address (Verified)</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 opacity-50" />
                          <input 
                            type="email" 
                            disabled
                            className="w-full pl-11 pr-5 py-4 bg-slate-100 border-2 border-slate-200 rounded-2xl font-bold text-slate-500 cursor-not-allowed"
                            value={email}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            required
                            className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-1"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Confirm Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input 
                            type={showPassword ? 'text' : 'password'} 
                            required
                            className="w-full pl-11 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="text-center pt-2">
                        <button 
                          type="button" 
                          onClick={() => { setActivationStep('email'); setSuccess(null); }}
                          className="text-[10px] font-black text-slate-400 hover:text-teal-600 uppercase tracking-widest transition-colors flex items-center justify-center gap-1 mx-auto"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back to Email Verification
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="text-xs font-bold leading-tight">{success}</p>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p className="text-xs font-bold leading-tight">{error}</p>
              </motion.div>
            )}

            <button 
              disabled={loading}
              className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Log In' : isReset ? 'Set Password' : activationStep === 'email' ? 'Verify Invitation' : 'Activate Account'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="pt-6 text-center">
              <button 
                type="button"
                onClick={() => handleTabChange(!isLogin)}
                className="text-[10px] font-black text-slate-400 hover:text-teal-600 uppercase tracking-widest transition-colors"
              >
                {isLogin ? "Have an invitation? Activate account" : "Already have an account? Log in"}
              </button>
            </div>
          </form>
        </motion.div>

        <p className="text-center mt-8 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] px-8">
          Secure access for Solution Delivery operations team only
        </p>
      </div>
    </div>
  );
};
