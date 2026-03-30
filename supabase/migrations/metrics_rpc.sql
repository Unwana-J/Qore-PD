-- metrics_rpc.sql: Calculates Dashboard Aggregations for Executive/Finance Dashboards

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_currency text DEFAULT 'All',
    p_portfolio text DEFAULT 'All',   -- 'All' | 'Enterprise' | 'Initiative'
    p_period text DEFAULT 'All Time', -- 'All Time' | '2023' | '2024' | etc
    p_date_from text DEFAULT NULL,
    p_date_to text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_total_projects integer;
    v_on_track integer;
    v_delayed integer;
    v_on_hold integer;
    v_signed_off integer;
    v_billed integer;
    v_closed integer;
    
    v_total_value_ngn numeric := 0;
    v_total_value_usd numeric := 0;
    v_recognized_ngn numeric := 0;
    v_recognized_usd numeric := 0;
    v_at_risk_ngn numeric := 0;
    v_at_risk_usd numeric := 0;
    
    v_avg_spi numeric := 0;
    v_valid_spi_count integer := 0;
    v_completion_rate numeric := 0;
BEGIN
    -- This function computes dashboard aggregations directly on the Postgres server,
    -- avoiding the need to transfer thousands of project rows to the client over HTTP.
    
    -- Filter out initiatives if requested
    -- Not fully implemented in this stub, but this is the structure
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE state = 'On-Track'),
        COUNT(*) FILTER (WHERE state = 'Delayed'),
        COUNT(*) FILTER (WHERE state = 'Suspended'),
        COUNT(*) FILTER (WHERE state = 'Signed Off'),
        COUNT(*) FILTER (WHERE state = 'Billed'),
        COUNT(*) FILTER (WHERE state = 'Closed')
    INTO 
        v_total_projects, v_on_track, v_delayed, v_on_hold, v_signed_off, v_billed, v_closed
    FROM projects
    WHERE 
        (p_currency = 'All' OR currency = p_currency) AND
        (p_portfolio = 'All' OR 
         (p_portfolio = 'Enterprise' AND is_internal_initiative = false AND priority = 'P1') OR
         (p_portfolio = 'Initiative' AND is_internal_initiative = true));

    -- Calculate Revenue Stats
    SELECT 
        COALESCE(SUM(value) FILTER (WHERE currency = 'NGN'), 0),
        COALESCE(SUM(value) FILTER (WHERE currency = 'USD'), 0),
        COALESCE(SUM(value) FILTER (WHERE currency = 'NGN' AND state IN ('Billed', 'Closed')), 0),
        COALESCE(SUM(value) FILTER (WHERE currency = 'USD' AND state IN ('Billed', 'Closed')), 0),
        COALESCE(SUM(value) FILTER (WHERE currency = 'NGN' AND state IN ('Delayed', 'Suspended')), 0),
        COALESCE(SUM(value) FILTER (WHERE currency = 'USD' AND state IN ('Delayed', 'Suspended')), 0)
    INTO
        v_total_value_ngn, v_total_value_usd, 
        v_recognized_ngn, v_recognized_usd,
        v_at_risk_ngn, v_at_risk_usd
    FROM projects
    WHERE is_internal_initiative = false
      AND (p_currency = 'All' OR currency = p_currency)
      AND (p_portfolio = 'All' OR (p_portfolio = 'Enterprise' AND priority = 'P1'));

    -- Completion Rate
    IF v_total_projects > 0 THEN
        v_completion_rate := (v_closed::numeric / v_total_projects::numeric) * 100;
    END IF;

    RETURN jsonb_build_object(
        'projectCounts', jsonb_build_object(
            'total', v_total_projects,
            'onTrack', v_on_track,
            'delayed', v_delayed,
            'onHold', v_on_hold,
            'readyForBilling', v_signed_off,
            'billed', v_billed,
            'closed', v_closed
        ),
        'revenueStats', jsonb_build_object(
            'total', jsonb_build_object('NGN', v_total_value_ngn, 'USD', v_total_value_usd),
            'recognized', jsonb_build_object('NGN', v_recognized_ngn, 'USD', v_recognized_usd),
            'atRisk', jsonb_build_object('NGN', v_at_risk_ngn, 'USD', v_at_risk_usd)
        ),
        'schedulePerformance', jsonb_build_object(
            'completionRate', v_completion_rate
        )
    );
END;
$$ LANGUAGE plpgsql;
