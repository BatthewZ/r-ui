import { MoreHorizontal } from "lucide-react";

import { Table } from "../../../src/components/data";
import { Select } from "../../../src/components/form";
import { Prose } from "../../../src/components/layout";
import { DropdownMenu } from "../../../src/components/overlays";
import { Button, Card, IconButton, StatusLabel } from "../../../src/components/primitives";
import { formatNumber } from "../../../src/util/format";
import { SERVICES, STATUS_LABEL } from "../../sections/data/fixtures";
import { TokenReadout } from "./parts";

/** The same UI in every box, so the only difference between boxes is the density they resolve. */
function Contents({ title, id }: { title: string; id: string }) {
  return (
    <>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>
          <TokenReadout />
        </Card.Description>
        <Card.Actions>
          <Button variant="secondary" data-probe="button">
            Export
          </Button>
          <DropdownMenu placement="bottom-end">
            <DropdownMenu.Trigger asChild>
              <IconButton label={`More actions for ${title}`} icon={<MoreHorizontal />} variant="secondary" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>Pin</DropdownMenu.Item>
              <DropdownMenu.Item>Copy link</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </Card.Actions>
      </Card.Header>
      <Card.Body className="flex flex-col gap-r3">
        <Table variant="rules" aria-label={`${title}: services`} data-probe="table">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Service</Table.HeaderCell>
              <Table.HeaderCell truncate={false}>Status</Table.HeaderCell>
              <Table.HeaderCell numeric>Req/s</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {SERVICES.slice(0, 3).map((s) => (
              <Table.Row key={s.id}>
                <Table.Cell>{s.name}</Table.Cell>
                <Table.Cell truncate={false}>
                  <StatusLabel tone={s.status}>{STATUS_LABEL[s.status]}</StatusLabel>
                </Table.Cell>
                <Table.Cell numeric>{formatNumber(s.rps)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <Select aria-label={`${title}: region`} defaultValue="eu" data-probe="select" id={`${id}-region`}>
          <option value="eu">Europe (Ireland)</option>
          <option value="us">US East (N. Virginia)</option>
        </Select>
      </Card.Body>
    </>
  );
}

export function NestingPanel() {
  return (
    <div data-density="comfortable" data-testid="stress-comfortable-page" className="flex flex-col gap-r2">
      <p className="text-body-2 text-fg-secondary">
        This box is <code>data-density=&quot;comfortable&quot;</code> whatever View says: <TokenReadout />
      </p>

      <Card data-testid="stress-comfortable-reference">
        <Contents title="Comfortable (reference)" id="nest-ref" />
      </Card>

      <Prose data-testid="stress-prose" className="rounded-lg border border-border p-r2">
        <h3>A prose region</h3>
        <p>
          Running text uses the fluid prose scale and reading leading. The card below sits inside it and is
          compact: its rows, controls and UI text come from the density it declares, not from the prose around it.
        </p>
        <Card data-density="compact" data-testid="stress-compact-in-prose">
          <Contents title="Compact card in prose" id="nest-prose" />
        </Card>
        <p>Back in the prose: the paragraph after the card is prose again.</p>
      </Prose>

      <Card data-density="compact" data-testid="stress-compact-outer">
        <Contents title="Compact card" id="nest-compact" />
        <Card.Body>
          <Card data-density="comfortable" data-testid="stress-comfortable-in-compact">
            <Contents title="Comfortable card inside the compact one" id="nest-inner" />
          </Card>
        </Card.Body>
      </Card>
    </div>
  );
}
