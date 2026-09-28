import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource/jetbrains-mono/400.css';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { App } from './App';
class ErrorBoundary extends React.Component<React.PropsWithChildren, {error:string}> {
 state={error:''};static getDerivedStateFromError(error:Error){return {error:error.message};}
 render(){if(this.state.error)return <div className="fatal"><h1>Не удалось открыть DBK</h1><p>{this.state.error}</p><button onClick={()=>location.reload()}>Перезагрузить приложение</button></div>;return this.props.children;}
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
