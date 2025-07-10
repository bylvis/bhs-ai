import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { App as AntdApp } from 'antd'
import 'antd/dist/reset.css'

createRoot(document.getElementById('root')).render(
    <AntdApp>
      <App />
    </AntdApp>
)
