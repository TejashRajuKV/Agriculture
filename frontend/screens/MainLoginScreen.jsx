import React, { useState, useLayoutEffect, useRef } from 'react';
import { UserRole } from '../utils/types.js';
import { Sprout } from 'lucide-react';
import { EnhancedScrollWrapper } from '../components/Common/EnhancedScroll.jsx';
import { Landing3D } from '../components/Landing/Landing3D.jsx';
import './LoginScreen.css';
import '../components/Landing/Landing.css';
import gsap from 'gsap';

export const LoginScreen = ({ onLogin }) => {
  return <Landing3D onGetStarted={onLogin} />;
};

export const MainLoginScreen = LoginScreen;