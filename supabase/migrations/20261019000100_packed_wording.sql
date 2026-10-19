-- Orders are no longer packed cold: the "packed" notification says what packing is.
-- advance_order is recreated exactly as 20261005000200_payments.sql left it, but for that one message.
create or replace function public.advance_order(order_id uuid, status text, carrier text default null, tracking text default null, note text default null)
returns public.orders language plpgsql security definer set search_path = public
as $$
declare changed public.orders;
begin
  if coalesce(public.platform_role(), '') not in ('owner', 'staff') then
    raise exception 'team access required' using errcode = '42501';
  end if;
  select * into changed from public.orders o where o.id = $1 for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if $2 is null or $2 not in ('paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded') then
    raise exception 'invalid order status' using errcode = '22023';
  end if;
  if $2='paid' and changed.payment <> 'authorized' then raise exception 'Payment marks this order paid.' using errcode='22023'; end if;
  if $2 in ('cancelled','refunded') then
    if changed.payment_provider is not null then raise exception 'Cancel or refund it from the order''s payment section.' using errcode='22023'; end if;
    if changed.payment='pending' then raise exception 'Cancel unpaid orders with Cancel order.' using errcode='22023'; end if;
  end if;
  if changed.status = $2 then return changed; end if;
  -- Forward movement, cancellation and refund only. Shipping may skip packing;
  -- authorized orders must be captured before fulfillment or referral approval.
  if not (
    (changed.status = 'placed' and $2 in ('paid', 'cancelled')) or
    (changed.status = 'paid' and $2 in ('packed', 'shipped', 'cancelled', 'refunded')) or
    (changed.status = 'packed' and $2 in ('shipped', 'cancelled', 'refunded')) or
    (changed.status = 'shipped' and $2 in ('delivered', 'refunded')) or
    (changed.status = 'delivered' and $2 = 'refunded')
  ) then raise exception 'invalid order transition' using errcode = '22023'; end if;
  update public.orders o set status = $2,
    payment = case when $2 = 'paid' then 'captured' when $2 = 'refunded' then 'refunded'
      when $2 = 'cancelled' then case when o.payment = 'captured' then 'refunded' else 'failed' end else o.payment end,
    carrier = coalesce(nullif(btrim($3), ''), o.carrier), tracking = coalesce(nullif(btrim($4), ''), o.tracking)
    where o.id = $1 returning * into changed;
  insert into public.order_events(order_id, status, note, actor_id, source) values ($1, $2, $5, auth.uid(), 'team');
  if $2 in ('cancelled', 'refunded') then
    update public.referrals r set status = 'void' where r.order_id = $1 and r.status in ('pending', 'approved');
  end if;
  insert into public.notifications(audience, kind, title, body, href) values
    ('buyer:' || changed.buyer_id::text, 'order.' || $2, 'Order ' || changed.number || ' is ' || $2,
      case when $2 = 'shipped' then coalesce(changed.carrier, 'Carrier') || coalesce(' ' || chr(183) || ' ' || changed.tracking, '')
        when $2 = 'packed' then 'Checked, sealed and ready to ship.'
        when $2 = 'delivered' then 'Certificates for each lot are in your account.'
        else 'Your order status has been updated.' end,
      '/account/orders/' || changed.id::text);
  return changed;
end;
$$;
