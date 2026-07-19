<?php

namespace App\Models;

use App\Models\Concerns\HasUuidPrimaryKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EInvoiceSettings extends Model
{
    use HasUuidPrimaryKey;

    protected $table = 'einvoice_settings';

    protected $fillable = [
        'id', 'tenant_id', 'is_active',
        'seller_name_ar', 'seller_name_en',
        'vat_number', 'cr_number',
        'building_number', 'street_name', 'district',
        'city', 'postal_code', 'country_code',
        'vat_rate', 'phase',
        // Phase 2
        'private_key', 'certificate', 'csr',
        'ccsid_token', 'ccsid_secret',
        'pcsid_token', 'pcsid_secret',
        'onboarding_status', 'invoice_counter',
        'last_invoice_hash', 'zatca_env',
    ];

    protected $casts = [
        'vat_rate'        => 'decimal:2',
        'is_active'       => 'boolean',
        'invoice_counter' => 'integer',
    ];

    protected $hidden = [
        'private_key',
        'ccsid_secret',
        'pcsid_secret',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
