import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiRequest } from '../../api/client';
import { PublicHeader } from '../../components/public/PublicHeader';
import { Button, Card, Input } from '../../components/ui';

const copy = {
  verify: { title: 'Xác minh email', action: 'Xác minh tài khoản' },
  forgot: { title: 'Quên mật khẩu', action: 'Gửi hướng dẫn đặt lại' },
  reset: { title: 'Đặt lại mật khẩu', action: 'Cập nhật mật khẩu' },
};

export function AuthRecoveryPage({ mode }) {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState({ busy: false, error: '', success: '' });
  const token = params.get('token') || '';

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'reset' && password !== confirmation) {
      setState({ busy: false, error: 'Mật khẩu xác nhận không khớp.', success: '' });
      return;
    }
    setState({ busy: true, error: '', success: '' });
    try {
      const path =
        mode === 'verify'
          ? '/auth/verify-email'
          : mode === 'forgot'
            ? '/auth/forgot-password'
            : '/auth/reset-password';
      const body = mode === 'verify' ? { token } : mode === 'forgot' ? { email } : { token, password };
      const result = await apiRequest(path, { method: 'POST', body });
      setState({
        busy: false,
        error: '',
        success:
          result?.message ||
          (mode === 'verify'
            ? 'Email đã được xác minh. Bạn có thể đăng nhập.'
            : 'Yêu cầu đã hoàn tất.'),
      });
    } catch (error) {
      setState({ busy: false, error: error.message, success: '' });
    }
  };

  return (
    <div className="min-h-screen bg-page text-ink">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-12">
        <Card className="p-6 sm:p-8">
          <h1 className="text-h2">{copy[mode].title}</h1>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === 'forgot' && (
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@email.com" />
            )}
            {mode === 'reset' && (
              <>
                <Input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu mới (ít nhất 10 ký tự)" />
                <Input type="password" autoComplete="new-password" required minLength={10} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Xác nhận mật khẩu mới" />
              </>
            )}
            {state.error && <p role="alert" className="text-sm text-rose-strong">{state.error}</p>}
            {state.success && <p role="status" className="text-sm text-brand-strong">{state.success}</p>}
            <Button type="submit" disabled={state.busy || (mode !== 'forgot' && !token)} className="w-full">
              {state.busy ? 'Đang xử lý...' : copy[mode].action}
            </Button>
          </form>
          <Link to="/login" className="mt-5 block text-center text-sm font-semibold text-brand-strong">Quay lại đăng nhập</Link>
        </Card>
      </main>
    </div>
  );
}
