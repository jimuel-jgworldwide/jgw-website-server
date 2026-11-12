'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, CheckCircle2, Mail, ExternalLink } from 'lucide-react';
import { DownloadProof } from './ui';

export function ProofPreview({ id, type }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl;
    setUrl(''); setError('');
    fetch(`/admin/proof/${id}?preview=1`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Preview could not be loaded.'); return response.blob(); })
      .then(blob => { if (controller.signal.aborted) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, attempt]);
  return <section className="admin-proof-preview"><h3>Payment proof</h3>
    {!url && !error && <p role="status"><LoaderCircle size={18} className="admin-spin" /> Loading proof…</p>}
    {error && <p role="alert">{error} <button className="admin-control" onClick={() => setAttempt(attempt + 1)}>Retry preview</button></p>}
    {url && (type?.startsWith('image/') ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open full-size payment proof"><img src={url} alt="Uploaded payment proof" /></a> : type === 'application/pdf' ? <iframe src={url} title="Payment proof PDF" /> : <p>This file type cannot be previewed.</p>)}
    <div className="admin-proof-actions">{url && <a className="admin-control" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />Open full size</a>}<DownloadProof href={`/admin/proof/${id}`} /></div>
  </section>;
}

export function ReviewPanel({ entry, onUpdate }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  async function act(action) {
    if (busy) return;
    setBusy(action); setMessage('');
    try {
      const response = await fetch(`/admin/entry/${entry.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, confirmReviewed: checked }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const updated = await fetch(`/admin/entry/${entry.id}`, { cache: 'no-store' });
      if (updated.ok) onUpdate((await updated.json()).entry);
      const statuses = { sent: 'Email sent.', not_configured: 'Email is queued. Configure Gmail on Vercel, then retry.', failed: 'Email failed. Check Gmail settings and retry below.', delivery_uncertain: 'Gmail accepted the email, but its status could not be saved. Check Sent Mail before retrying.', already_sent_or_busy: 'Email was already sent or is being processed.' };
      setMessage(`${action === 'approve' ? 'Payment approved. ' : ''}${statuses[result.emailStatus] || ''}`);
      setChecked(false); router.refresh();
    } catch (e) { setMessage(e.message || 'Could not complete this action. Refresh to check its status.'); }
    finally { setBusy(''); }
  }
  const awaitingPayment = entry.payment_method === null && entry.payment_status !== 'approved';
  const receipt = entry.emails?.find(job => job.kind === 'receipt');
  const sendingReceipt = receipt?.status === 'sending' && Date.now() - Date.parse(receipt.claimed_at) < 300000;
  return <section className="admin-review-panel"><h3>Payment review</h3>
    {awaitingPayment ? <>
      <p>Awaiting payment proof. {receipt?.status === 'sent' ? 'Payment instructions sent.' : 'Payment instructions have not been marked as sent.'}</p>
      {entry.reviewReady && receipt?.status !== 'sent' && <button className="admin-control" disabled={Boolean(busy) || sendingReceipt} onClick={() => act('receipt')}>{busy === 'receipt' || sendingReceipt ? 'Sending…' : 'Retry payment email'}</button>}
    </> : <>
    <span className={`admin-review-status ${entry.payment_status === 'approved' ? 'is-approved' : ''}`}>{entry.payment_status === 'approved' ? <CheckCircle2 size={16} /> : <Mail size={16} />}{entry.payment_status === 'approved' ? 'Approved · registration confirmed' : 'Pending review'}</span>
    {!entry.reviewReady ? <p>Payment review is not configured yet. Install migration 003 before approving entries.</p> : <>
      {entry.payment_status !== 'approved' ? <><p>Check the proof and the actual payment received. The fee is ₱1,000 per head for every participant.</p><label className="admin-review-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />I have verified that the full payment was received.</label><button className="admin-control admin-approve" disabled={!checked || Boolean(busy)} onClick={() => act('approve')}>{busy === 'approve' && <LoaderCircle className="admin-spin" size={16} />}Approve payment &amp; confirm registration</button></> : <p>Reviewed {entry.reviewed_at ? new Date(entry.reviewed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : ''}</p>}
      {entry.payment_status === 'approved' && <div className="admin-email-status">{['approval'].map(kind => {
        const job = entry.emails?.find(item => item.kind === kind);
        const processing = job?.status === 'sending' && Date.now() - Date.parse(job.claimed_at) < 300000;
        return <div key={kind}><span>Approval confirmation<small>{job?.status || 'Not queued'}</small></span>{job?.status !== 'sent' && <button className="admin-control" disabled={Boolean(busy) || processing} onClick={() => act(kind)}>{busy === kind ? 'Sending…' : processing ? 'Sending…' : job ? 'Retry email' : 'Send email'}</button>}</div>;
      })}</div>}
    </>}
    </>}
    {message && <p className="admin-review-message" role="status">{message}</p>}
  </section>;
}
