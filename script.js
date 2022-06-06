define(['jquery', 'underscore', 'twigjs'], function ($, _, Twig) {
  var CustomWidget = function () {
    var self = this

    this.exportToCsv = function exportToCsv(filename, rows) {
      var processRow = function (row) {
        var finalVal = ''
        for (var j = 0; j < row.length; j++) {
          var innerValue = row[j] === null ? '' : row[j].toString()
          if (row[j] instanceof Date) {
            innerValue = row[j].toLocaleString()
          }
          var result = innerValue.replace(/"/g, '""')
          if (result.search(/("|,|\n)/g) >= 0) result = '"' + result + '"'
          if (j > 0) {
            finalVal += ','
          }
          finalVal += result
        }
        return finalVal + '\n'
      }

      var csvFile = ''
      for (var i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i])
      }

      var blob = new Blob([csvFile], { type: 'text/csv;charset=windows-1251;' })
      if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, filename)
      } else {
        var link = document.createElement('a')
        if (link.download !== undefined) {
          // feature detection
          // Browsers that support HTML5 download attribute
          var url = URL.createObjectURL(blob)
          link.setAttribute('href', url)
          link.setAttribute('download', filename)
          link.style.visibility = 'hidden'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    }

    this.callbacks = {
      render: function () {
        console.log('render')
        return true
      },
      init: _.bind(function () {
        console.log('init')

        return true
      }, this),

      bind_actions: function () {
        console.log('bind_actions')
        return true
      },
      settings: function () {
        return true
      },
      onSave: function () {
        alert('click')
        return true
      },
      destroy: function () {},

      leads: {
        selected: function () {
          self.widgetsOverlay(false)

          //== получаю айдишники выбранных сделок
          var $selectedLeads = $('.js-page-delimiter input:checked')
          var selectedLeadsIds = []

          $selectedLeads.each(function () {
            var leadId = +$(this).val()
            selectedLeadsIds.push(leadId)
          })

          //== Формирую query параметры для запроса на получение выбранных сделок
          var leadsQuery = selectedLeadsIds
            .map(function (id) {
              return 'filter[id][]=' + id
            })
            .join('&')

          //== Делаю ад коллбэков (Потому что ES5) из трех запросов на получение сделок, связанных контактов и компаний
          //== Получаю список сделок с их контактами
          $.get('/api/v4/leads?with=contacts&' + leadsQuery, function (data) {
            var selectedLeads = data._embedded.leads

            //== получаю айдишники всех задействованных контактов со всех сделок
            var contactsIds = selectedLeads.reduce(function (memo, lead) {
              lead._embedded.contacts.forEach(function (contact) {
                if (memo.includes(contact.id)) return

                memo.push(contact.id)
              })

              return memo
            }, [])

            //== Формирую query параметры для запроса на получение задействованных контактов
            var contactsQuery = contactsIds
              .map(function (id) {
                return 'filter[id][]=' + id
              })
              .join('&')

            //== Получаю список контактов
            $.get('/api/v4/contacts?' + contactsQuery, function (data) {
              var contacts = data._embedded.contacts

              //== получаю айдишники всех задействованных компаний со всех сделок
              var companiesIds = selectedLeads.reduce(function (memo, lead) {
                lead._embedded.companies.forEach(function (company) {
                  if (memo.includes(company.id)) return

                  memo.push(company.id)
                })

                return memo
              }, [])

              //== Формирую query параметры для запроса на получение задействованных компаний
              var companiesQuery = companiesIds
                .map(function (id) {
                  return 'filter[id][]=' + id
                })
                .join('&')

              //== Получаю список компаний
              $.get('/api/v4/companies?' + companiesQuery, function (data) {
                var companies = data._embedded.companies

                //== ад коллбэков заканчивается, формирую таблицу из полученных данных
                var excelTable = [
                  [
                    'Название',
                    'Дата создания',
                    'Теги',
                    'Кастомные поля',
                    'Компании',
                    'Контакты',
                  ],
                ]

                selectedLeads.forEach((lead) => {
                  //== Формирую дату создания сделки в формате DD.MM.YYYY
                  var creationDate = new Date(lead.created_at)
                  var beautifyCreationDate =
                    creationDate.getDate() +
                    '.' +
                    creationDate.getMonth() +
                    '.' +
                    creationDate.getFullYear()

                  var selectedCompanies = lead._embedded.companies
                  var selectedContacts = lead._embedded.contacts

                  //== формирую строку из имен связанных компаний для конкретной сделки
                  var companiesNames = companies
                    .reduce(function (memo, company) {
                      var isCompanySelected = selectedCompanies.find(function (
                        c
                      ) {
                        return c.id == company.id
                      })

                      if (isCompanySelected) memo.push(company.name)
                      return memo
                    }, [])
                    .join(', ')

                  //== формирую строку из имен связанных контактов для конкретной сделки
                  var contactsNames = contacts
                    .reduce(function (memo, contact) {
                      var isContactSelected = selectedContacts.find(function (
                        c
                      ) {
                        return c.id == contact.id
                      })

                      if (isContactSelected) memo.push(contact.name)
                      return memo
                    }, [])
                    .join(', ')

                  var tags = lead._embedded.tags
                    .map(function (tag) {
                      return tag.name
                    })
                    .join(', ')

                  excelTable.push([
                    lead.name,
                    beautifyCreationDate,
                    tags,
                    ' ',
                    companiesNames,
                    contactsNames,
                  ])
                })

                self.exportToCsv('name', excelTable)
              })
            })
          })

          return true
        },
      },
    }
    return this
  }

  return CustomWidget
})
