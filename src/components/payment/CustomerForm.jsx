import Input from '../common/Input'

/**
 * CustomerForm
 *
 * The only customer information collected in this demo:
 *   full name, email address and mobile number.
 *
 * No password, PIN, OTP, card number or banking credential is ever asked
 * for — a real gateway would collect those inside its own hosted page, not
 * in our form.
 *
 * Props:
 *   values  {fullName, email, phone}
 *   errors  {fullName?, email?, phone?}
 *   onChange(field, value)
 */
export default function CustomerForm({ values, errors = {}, onChange }) {
  const handleChange = (field) => (event) => {
    onChange?.(field, event.target.value)
  }

  return (
    <section className="panel" aria-labelledby="customer-info-heading">
      <header className="panel-header">
        <h2 id="customer-info-heading" className="text-sm font-semibold text-slate-900">
          Customer information
        </h2>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Used to create the demo order. No PIN, OTP or card details are requested.
        </p>
      </header>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <Input
          label="Full name"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Ayesha Khan"
          value={values.fullName}
          onChange={handleChange('fullName')}
          error={errors.fullName}
          required
          className="sm:col-span-2"
        />

        <Input
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={values.email}
          onChange={handleChange('email')}
          error={errors.email}
          required
        />

        <Input
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="03001234567"
          value={values.phone}
          onChange={handleChange('phone')}
          error={errors.phone}
          hint="Pakistani mobile number, e.g. 03001234567"
          required
        />
      </div>
    </section>
  )
}
