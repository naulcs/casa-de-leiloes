import { formatCurrency } from "../format.js";

export default function BidHistory({ bids }) {
  if (bids.length === 0) {
    return <p>Nenhum lance ainda. O primeiro lance pode ser o seu.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Licitante</th>
            <th>Valor</th>
            <th>Horário</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((bid) => (
            <tr key={bid.seq} className={bid.mine ? "mine" : undefined}>
              <td>{bid.seq}</td>
              <td>
                {bid.bidder}
                {bid.mine ? " (você)" : ""}
              </td>
              <td>{formatCurrency(bid.amount_cents)}</td>
              <td>{new Date(bid.placed_at).toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
