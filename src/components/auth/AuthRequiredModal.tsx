import React from 'react';
import { Lock, ShieldCheck, UserCheck, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { keycloakConfig } from '../../auth/keycloak';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  onBypassDemo?: () => void;
  actionTitle?: string;
  authError?: string | null;
}

export const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onBypassDemo,
  actionTitle = 'CAD Stúdió & Alaprajz Szerkesztés',
  authError,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/50 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 shadow-2xl">
        {/* Header */}
        <div className="p-3.5 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              HITELESÍTÉS SZÜKSÉGES // POLLÁK SSO
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 font-sans text-xs text-[#1A3C2B]">
          {authError && (
            <div className="bg-red-50 border-2 border-red-600 text-red-900 p-3 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-xs font-bold text-red-950 mb-0.5">BEJELENTKEZÉS ELUTASÍTVA</strong>
                <p className="text-[11px] leading-tight text-red-800">{authError}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 bg-white p-3.5 border border-[#1A3C2B]/30">
            <ShieldCheck className="w-6 h-6 text-[#1A3C2B] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-[#1A3C2B] mb-1">
                {actionTitle}
              </h4>
              <p className="text-[#1A3C2B]/75 leading-relaxed">
                Az alaprajzok szerkesztéséhez és kezeléséhez bejelentkezés szükséges. A hozzáférés kizárólag <b>ADMIN</b> vagy <b>TEACHER</b> Realm szerepkörrel rendelkező fiókok számára engedélyezett.
              </p>
            </div>
          </div>

          <div className="font-mono text-[10px] text-[#1A3C2B]/70 bg-[#F0F5F2] p-2.5 border border-[#D0D0C7]">
            <div className="flex justify-between mb-0.5">
              <span>KEYCLOAK SZERVER:</span>
              <span className="font-bold">{keycloakConfig.url}</span>
            </div>
            <div className="flex justify-between mb-0.5">
              <span>REALM / KLIENS:</span>
              <span className="font-bold">{keycloakConfig.realm} / {keycloakConfig.clientId}</span>
            </div>
            <div className="flex justify-between text-emerald-800 font-bold border-t border-[#D0D0C7] pt-1 mt-1">
              <span>ENGEDÉLYEZETT SZEREPKÖRÖK:</span>
              <span>ADMIN, TEACHER</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={onLogin}
              className="w-full py-2.5 bg-[#1A3C2B] text-[#F7F7F5] hover:bg-[#2A533E] font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <UserCheck className="w-4 h-4" />
              <span>BEJELENTKEZÉS POLLÁK FIÓKKAL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {onBypassDemo && (
              <button
                onClick={onBypassDemo}
                className="w-full py-2 bg-white hover:bg-[#F0F5F2] border border-[#1A3C2B] text-[#1A3C2B] font-mono text-[10px] font-bold transition-colors"
              >
                KIPRÓBÁLÁS DEMO SZERKESZTŐKÉNT (OFFLINE TESZT)
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-white border-t border-[#1A3C2B]/20 flex justify-between items-center text-[10px] font-mono text-[#1A3C2B]/60">
          <span>Pollák Dékáni & Informatikai Rendszer</span>
          <button onClick={onClose} className="hover:underline text-[#1A3C2B]">
            Mégse
          </button>
        </div>
      </div>
    </div>
  );
};
