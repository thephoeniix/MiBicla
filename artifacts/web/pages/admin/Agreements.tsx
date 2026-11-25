import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api-client";
import { Button, Card, EmptyState, PageHeader, StatusBadge, Tabs } from "../../components/ui";

interface Team { id: string; name: string; active: boolean }
interface Agreement { id: string; teamId: string; discountType: "percentage" | "fixed"; value: number; validFrom: string; validUntil: string | null; conditions: string | null; active: boolean; combinable: boolean }
interface AgreementRow { agreement: Agreement; team: Team }
interface Affiliation { id: string; proposedTeamName: string | null; status: string; evidenceNote: string | null; createdAt: string }
interface AffiliationRow { affiliation: Affiliation; team: Team | null; customer: { id: string; firstName: string; lastName: string } }

const today = () => new Date().toISOString().slice(0, 10);
const emptyAgreement = { id: "", teamId: "", discountType: "percentage" as const, value: "", validFrom: today(), validUntil: "", conditions: "", active: true, combinable: false };

export function Agreements({ permissions = [] }: { permissions?: string[] }) {
  const allowed = permissions.includes("manage_workshop_agreements");
  const [teams, setTeams] = useState<Team[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationRow[]>([]);
  const [tab, setTab] = useState("affiliations");
  const [teamForm, setTeamForm] = useState({ id: "", name: "", active: true });
  const [agreementForm, setAgreementForm] = useState(emptyAgreement);
  const [review, setReview] = useState<{ id: string; evidenceNote: string } | null>(null);
  const [notice, setNotice] = useState("");

  async function load() {
    if (!allowed) return;
    try {
      const [nextTeams, nextAgreements, nextAffiliations] = await Promise.all([
        apiFetch<Team[]>("/api/admin/workshop/teams?includeInactive=true"),
        apiFetch<AgreementRow[]>("/api/admin/workshop/agreements?includeInactive=true"),
        apiFetch<AffiliationRow[]>("/api/admin/workshop/affiliations"),
      ]);
      setTeams(nextTeams); setAgreements(nextAgreements); setAffiliations(nextAffiliations);
    } catch (error) { setNotice(error instanceof ApiError ? error.message : "No fue posible cargar convenios."); }
  }
  useEffect(() => { void load(); }, [allowed]);

  async function saveTeam(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch(`/api/admin/workshop/teams${teamForm.id ? `/${teamForm.id}` : ""}`, { method: teamForm.id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: teamForm.name.trim(), active: teamForm.active }) });
      setTeamForm({ id: "", name: "", active: true }); setNotice("Equipo guardado."); await load();
    } catch (error) { setNotice(error instanceof ApiError ? error.message : "No fue posible guardar el equipo."); }
  }
  async function saveAgreement(event: FormEvent) {
    event.preventDefault();
    const entered = Number(agreementForm.value);
    const value = agreementForm.discountType === "percentage" ? Math.round(entered * 100) : Math.round(entered * 100);
    try {
      await apiFetch(`/api/admin/workshop/agreements${agreementForm.id ? `/${agreementForm.id}` : ""}`, { method: agreementForm.id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ teamId: agreementForm.teamId, discountType: agreementForm.discountType, value, validFrom: agreementForm.validFrom, validUntil: agreementForm.validUntil || null, conditions: agreementForm.conditions.trim() || null, active: agreementForm.active, combinable: agreementForm.combinable }) });
      setAgreementForm(emptyAgreement); setNotice("Convenio guardado."); await load();
    } catch (error) { setNotice(error instanceof ApiError ? error.message : "No fue posible guardar el convenio."); }
  }
  async function resolveAffiliation(status: "verified" | "rejected" | "expired") {
    if (!review?.evidenceNote.trim()) { setNotice("La nota de evidencia es obligatoria."); return; }
    try {
      await apiFetch(`/api/admin/workshop/affiliations/${review.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, evidenceNote: review.evidenceNote.trim() }) });
      setReview(null); setNotice("Solicitud revisada."); await load();
    } catch (error) { setNotice(error instanceof ApiError ? error.message : "No fue posible revisar la solicitud."); }
  }
  if (!allowed) return <section className="admin-page"><PageHeader eyebrow="Taller" title="Equipos y convenios" description="No tienes permiso para administrar esta sección." /></section>;
  return <section className="admin-page agreements-page">
    <PageHeader eyebrow="Taller" title="Equipos y convenios" description="Administra afiliaciones verificadas y beneficios aplicables a órdenes." />
    {notice && <p className="form-error" role="status">{notice}</p>}
    <Tabs label="Administración de convenios" active={tab} onChange={setTab} items={[{ id: "affiliations", label: `Solicitudes · ${affiliations.filter((row) => row.affiliation.status === "pending").length}` }, { id: "teams", label: `Equipos · ${teams.length}` }, { id: "agreements", label: `Convenios · ${agreements.length}` }]} />
    {tab === "affiliations" && <div className="agreement-list">{affiliations.map((row) => <Card key={row.affiliation.id} className="agreement-card"><header><div><small>{new Date(row.affiliation.createdAt).toLocaleDateString("es-MX")}</small><h3>{row.customer.firstName} {row.customer.lastName}</h3></div><StatusBadge status={row.affiliation.status} /></header><p>Equipo: <strong>{row.team?.name ?? row.affiliation.proposedTeamName}</strong></p>{row.affiliation.evidenceNote && <p>Nota: {row.affiliation.evidenceNote}</p>}{row.affiliation.status === "pending" && (review?.id === row.affiliation.id ? <div className="affiliation-review"><label>Nota de evidencia<textarea required value={review.evidenceNote} onChange={(event) => setReview({ ...review, evidenceNote: event.target.value })} placeholder="Documento, contacto o motivo de resolución" /></label><div><Button type="button" onClick={() => void resolveAffiliation("verified")}>Verificar</Button><Button type="button" variant="secondary" onClick={() => void resolveAffiliation("rejected")}>Rechazar</Button><Button type="button" variant="ghost" onClick={() => void resolveAffiliation("expired")}>Expirar</Button></div></div> : <Button type="button" variant="secondary" onClick={() => setReview({ id: row.affiliation.id, evidenceNote: "" })}>Revisar solicitud</Button>)}</Card>)}{!affiliations.length && <EmptyState title="Sin solicitudes" description="Las solicitudes de afiliación aparecerán aquí." />}</div>}
    {tab === "teams" && <div className="agreement-admin-grid"><form className="ui-card agreement-form" onSubmit={saveTeam}><h2>{teamForm.id ? "Editar equipo" : "Nuevo equipo"}</h2><label>Nombre<input required maxLength={200} value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} /></label><label className="checkbox-row"><input type="checkbox" checked={teamForm.active} onChange={(event) => setTeamForm({ ...teamForm, active: event.target.checked })} /> Equipo activo</label><div><Button>{teamForm.id ? "Guardar cambios" : "Crear equipo"}</Button>{teamForm.id && <Button type="button" variant="ghost" onClick={() => setTeamForm({ id: "", name: "", active: true })}>Cancelar</Button>}</div></form><div className="agreement-list">{teams.map((team) => <Card key={team.id} className="agreement-card"><header><h3>{team.name}</h3><StatusBadge status={team.active ? "active" : "inactive"} /></header><Button type="button" variant="secondary" onClick={() => setTeamForm({ id: team.id, name: team.name, active: team.active })}>Editar</Button></Card>)}</div></div>}
    {tab === "agreements" && <div className="agreement-admin-grid"><form className="ui-card agreement-form" onSubmit={saveAgreement}><h2>{agreementForm.id ? "Editar convenio" : "Nuevo convenio"}</h2><label>Equipo<select required value={agreementForm.teamId} onChange={(event) => setAgreementForm({ ...agreementForm, teamId: event.target.value })}><option value="">Selecciona</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.active ? "" : " (inactivo)"}</option>)}</select></label><div className="agreement-fields"><label>Tipo<select value={agreementForm.discountType} onChange={(event) => setAgreementForm({ ...agreementForm, discountType: event.target.value as "percentage" | "fixed" })}><option value="percentage">Porcentaje</option><option value="fixed">Monto fijo</option></select></label><label>{agreementForm.discountType === "percentage" ? "Porcentaje" : "Monto (MXN)"}<input required type="number" min="0.01" max={agreementForm.discountType === "percentage" ? "100" : undefined} step="0.01" value={agreementForm.value} onChange={(event) => setAgreementForm({ ...agreementForm, value: event.target.value })} /></label><label>Vigente desde<input required type="date" value={agreementForm.validFrom} onChange={(event) => setAgreementForm({ ...agreementForm, validFrom: event.target.value })} /></label><label>Vigente hasta<input type="date" min={agreementForm.validFrom} value={agreementForm.validUntil} onChange={(event) => setAgreementForm({ ...agreementForm, validUntil: event.target.value })} /></label></div><label>Condiciones<textarea value={agreementForm.conditions} onChange={(event) => setAgreementForm({ ...agreementForm, conditions: event.target.value })} /></label><label className="checkbox-row"><input type="checkbox" checked={agreementForm.active} onChange={(event) => setAgreementForm({ ...agreementForm, active: event.target.checked })} /> Activo</label><label className="checkbox-row"><input type="checkbox" checked={agreementForm.combinable} onChange={(event) => setAgreementForm({ ...agreementForm, combinable: event.target.checked })} /> Combinable con descuento manual</label><div><Button>{agreementForm.id ? "Guardar cambios" : "Crear convenio"}</Button>{agreementForm.id && <Button type="button" variant="ghost" onClick={() => setAgreementForm(emptyAgreement)}>Cancelar</Button>}</div></form><div className="agreement-list">{agreements.map(({ agreement, team }) => <Card key={agreement.id} className="agreement-card"><header><div><small>{team.name}</small><h3>{agreement.discountType === "percentage" ? `${agreement.value / 100}%` : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(agreement.value / 100)}</h3></div><StatusBadge status={agreement.active ? "active" : "inactive"} /></header><p>{agreement.validFrom} a {agreement.validUntil ?? "sin vencimiento"}</p><p>{agreement.conditions || "Sin condiciones adicionales"} · {agreement.combinable ? "Combinable" : "No combinable"}</p><Button type="button" variant="secondary" onClick={() => setAgreementForm({ id: agreement.id, teamId: agreement.teamId, discountType: agreement.discountType, value: String(agreement.value / 100), validFrom: agreement.validFrom, validUntil: agreement.validUntil ?? "", conditions: agreement.conditions ?? "", active: agreement.active, combinable: agreement.combinable })}>Editar</Button></Card>)}</div></div>}
  </section>;
}
