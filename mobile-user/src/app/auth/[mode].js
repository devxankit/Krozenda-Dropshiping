import { LoginScreen } from '../../modules/auth/LoginScreen'

// /auth/login | /auth/welcome | /auth/mobile | /auth/otp | /auth/verified (all the same screen,
// like modules/auth/routes.jsx on the web).
export default function AuthRoute() {
  return <LoginScreen />
}
