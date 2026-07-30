'use client'

// Conmutador central de modales — cada modal replica el del prototipo.

import { useApp } from './store'

import ProductoModal from './modals/ProductoModal'
import CategoriasModal from './modals/CategoriasModal'
import AjusteInvModal from './modals/AjusteInvModal'
import TrasladoModal from './modals/TrasladoModal'
import ClienteModal from './modals/ClienteModal'
import AbonoModal from './modals/AbonoModal'
import CreditoVentaModal from './modals/CreditoVentaModal'
import VentaDetalleModal from './modals/VentaDetalleModal'
import DevolucionModal from './modals/DevolucionModal'
import ProveedorModal from './modals/ProveedorModal'
import AbonoCompraModal from './modals/AbonoCompraModal'
import CompraDetalleModal from './modals/CompraDetalleModal'
import ItemDscModal from './modals/ItemDscModal'
import UsuariosModal from './modals/UsuariosModal'
import UsuarioFormModal from './modals/UsuarioFormModal'
import AjustesModal from './modals/AjustesModal'
import AperturaCajaModal from './modals/AperturaCajaModal'
import AperturaModal from './modals/AperturaModal'
import ConfirmModal from './modals/ConfirmModal'
import ContactModal from './modals/ContactModal'
import PesoModal from './modals/PesoModal'
import NovedadesModal from './modals/NovedadesModal'

export default function Modals() {
  const s = useApp()
  switch (s.modal) {
    case 'producto':
      return <ProductoModal />
    case 'categorias':
      return <CategoriasModal />
    case 'ajusteinv':
      return <AjusteInvModal />
    case 'traslado':
      return <TrasladoModal />
    case 'cliente':
      return <ClienteModal />
    case 'abono':
      return <AbonoModal />
    case 'creditoVenta':
      return <CreditoVentaModal />
    case 'ventaDetalle':
      return <VentaDetalleModal />
    case 'devolucion':
      return <DevolucionModal />
    case 'proveedor':
      return <ProveedorModal />
    case 'abonoCompra':
      return <AbonoCompraModal />
    case 'compraDetalle':
      return <CompraDetalleModal />
    case 'itemDsc':
      return <ItemDscModal />
    case 'usuarios':
      return <UsuariosModal />
    case 'usuarioForm':
      return <UsuarioFormModal />
    case 'ajustes':
      return <AjustesModal />
    case 'aperturaCaja':
      return <AperturaCajaModal />
    case 'apertura':
      return <AperturaModal />
    case 'confirm':
      return <ConfirmModal />
    case 'contact':
      return <ContactModal />
    case 'peso':
      return <PesoModal />
    case 'novedades':
      return <NovedadesModal />
    default:
      return null
  }
}
