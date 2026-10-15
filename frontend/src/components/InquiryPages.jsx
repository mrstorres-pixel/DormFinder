import { useParams } from 'react-router-dom'
import MessagingWorkspace from './MessagingWorkspace'

export function InquiryList() { return <MessagingWorkspace /> }
export function InquiryThread() { const { id } = useParams(); return <MessagingWorkspace key={id} id={id} /> }
